import { Router } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { UserRole } from '../models/User.js';
import { WeeklyRequest, WeeklyRequestStatus } from '../models/WeeklyRequest.js';
import { Settings } from '../models/Settings.js';
import { Patient } from '../models/Patient.js';
import { WeeklyPlanItem } from '../models/WeeklyPlanItem.js';
import { WeeklyPlan } from '../models/WeeklyPlan.js';
import { TransfusionRecord } from '../models/TransfusionRecord.js';
import { AuditLog, AuditAction, AuditResource } from '../models/AuditLog.js';
import { getWeekRange, getZonedWeekday } from '../utils/weekUtils.js';
import { adDateToBsString, bsToAdDate, isValidBsDate, normalizeToBsDate } from '../utils/bsDate.js';

const router = Router();

router.use(authenticate);

async function loadSettings() {
  let settings = await Settings.findOne({});
  if (!settings) {
    // Create settings with default values by not providing any data
    settings = new Settings();
    await settings.save();
  }
  return settings;
}

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// GET /api/weekly-requests/availability - Availability by hospital/day for a week
router.get('/availability', authorize(UserRole.DATA_ENTRY, UserRole.SUPER_ADMIN), async (req: any, res) => {
  try {
    const { weekStart } = req.query;
    if (!weekStart) {
      return res.status(400).json({ success: false, message: 'weekStart is required' });
    }
    const weekStartRaw = normalizeToBsDate(String(weekStart));
    if (!isValidBsDate(weekStartRaw)) {
      return res.status(400).json({ success: false, message: 'Invalid weekStart' });
    }
    const parsed = bsToAdDate(weekStartRaw);
    if (!parsed || Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid weekStart' });
    }

    const settings = await loadSettings();
    const rangeAd = {
      weekStart: new Date(parsed),
      weekEnd: new Date(parsed)
    };
    rangeAd.weekStart.setUTCHours(0, 0, 0, 0);
    rangeAd.weekEnd.setUTCHours(23, 59, 59, 999);
    rangeAd.weekEnd.setUTCDate(rangeAd.weekEnd.getUTCDate() + 6);
    const rangeBs = {
      weekStart: adDateToBsString(rangeAd.weekStart),
      weekEnd: adDateToBsString(rangeAd.weekEnd)
    };

    const days = WEEK_DAYS.map((dayName, index) => {
      const date = new Date(rangeAd.weekStart);
      date.setUTCDate(date.getUTCDate() + index);
      return { name: dayName, date: adDateToBsString(date) };
    });
    const dayByDate = new Map(days.map((entry) => [entry.date, entry.name]));

    const plans = await WeeklyPlanItem.find({
      assignedDate: { $gte: rangeBs.weekStart, $lte: rangeBs.weekEnd }
    });

    const requests = await WeeklyRequest.find({
      weekStart: rangeBs.weekStart,
      $or: [
        { preferredDay: { $in: WEEK_DAYS } },
        { preferredDate: { $gte: rangeBs.weekStart, $lte: rangeBs.weekEnd } }
      ]
    });

    const requestById = new Map<string, any>();
    const requestsToUpdate: any[] = [];
    for (const request of requests) {
      if (request.preferredDate) {
        const mappedDay = dayByDate.get(request.preferredDate);
        if (mappedDay && request.preferredDay !== mappedDay) {
          request.preferredDay = mappedDay;
          requestsToUpdate.push(request);
        }
      }
      requestById.set(request._id.toString(), request);
    }
    if (requestsToUpdate.length > 0) {
      await Promise.all(requestsToUpdate.map((request) => request.save()));
    }

    const hospitals = settings.hospitalList || [];
    const capacityMap = new Map<string, Record<string, number>>();
    const capacityEntries = settings.hospitalCapacities || [];
    for (const entry of capacityEntries) {
      if (entry?.name) {
        capacityMap.set(entry.name, { ...(entry as any).slots });
      }
    }

    const plannedByHospital: Record<string, Record<string, number>> = {};

    for (const hospital of hospitals) {
      plannedByHospital[hospital] = {};
      for (const day of WEEK_DAYS) {
        plannedByHospital[hospital][day] = 0;
      }
    }

    for (const item of plans) {
      const hospital = item.assignedHospital;
      if (!plannedByHospital[hospital]) {
        plannedByHospital[hospital] = {};
        for (const day of WEEK_DAYS) {
          plannedByHospital[hospital][day] = 0;
        }
      }
      const linkedRequest = requestById.get(item.requestId.toString());
      let dateKey = item.assignedDate;
      if (linkedRequest?.preferredDate) {
        const preferredKey = linkedRequest.preferredDate;
        const assignedKey = dateKey;
        if (preferredKey !== assignedKey && item.created_at && item.updated_at && item.created_at.getTime() === item.updated_at.getTime()) {
          item.assignedDate = preferredKey;
          await item.save();
        }
        dateKey = preferredKey;
      }
      const assignedAd = bsToAdDate(item.assignedDate);
      const day = dayByDate.get(dateKey) || (assignedAd ? getZonedWeekday(assignedAd, settings.weekTimeZone) : 'Sunday');
      plannedByHospital[hospital][day] = (plannedByHospital[hospital][day] || 0) + 1;
    }

    // requestedByDay is no longer used for availability calculations

    // reuse days computed above

    const availability = hospitals.map((hospital) => {
      const slots = capacityMap.get(hospital) || {};
      const capacityByDay: Record<string, number> = {};
      for (const day of WEEK_DAYS) {
        const numeric = Number(slots[day]);
        capacityByDay[day] = Number.isFinite(numeric) ? numeric : 0;
      }
      const planned = plannedByHospital[hospital] || {};
      const requestedByDay: Record<string, number> = {};
      for (const day of WEEK_DAYS) {
        if (planned[day] === undefined) planned[day] = 0;
        requestedByDay[day] = 0;
      }
      return {
        name: hospital,
        capacityByDay,
        plannedByDay: planned,
        requestedByDay
      };
    });

    return res.json({
      success: true,
      data: {
        weekStart: rangeBs.weekStart,
        weekEnd: rangeBs.weekEnd,
        days,
        hospitals: availability
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/weekly-requests - Create a weekly request (DATA_ENTRY or SUPER_ADMIN)
router.post('/', authorize(UserRole.DATA_ENTRY, UserRole.SUPER_ADMIN), async (req: any, res) => {
  try {
    const {
      patientId,
      callDate,
      requestedUnits,
      requestedHospital,
      preferredDay,
      preferredDate,
      remarks
    } = req.body;

    if (!patientId || !callDate || !requestedUnits || !requestedHospital || !preferredDate) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ success: false, message: 'Patient not found' });
    }

    const settings = await loadSettings();
    // Temporarily bypass hospital validation for testing
    // if (settings && settings.hospitalList && settings.hospitalList.length > 0 && !settings.hospitalList.includes(requestedHospital)) {
    //   return res.status(400).json({ success: false, message: 'Invalid hospital' });
    // }

    const callDateBs = normalizeToBsDate(callDate);
    if (!isValidBsDate(callDateBs)) {
      return res.status(400).json({ success: false, message: 'Invalid callDate' });
    }
    const parsedCallDate = bsToAdDate(callDateBs);
    if (!parsedCallDate || Number.isNaN(parsedCallDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid callDate' });
    }

    const weekday = getZonedWeekday(parsedCallDate, settings.weekTimeZone);
    const isFriday = weekday === 'Friday';
    if (!isFriday && !settings.allowBackEntry) {
      return res.status(400).json({ success: false, message: 'Back-entry not allowed' });
    }

    const { weekStart, weekEnd } = getWeekRange(
      parsedCallDate,
      settings.weekStartDay,
      settings.weekTimeZone
    );
    const weekStartBs = adDateToBsString(weekStart);
    const weekEndBs = adDateToBsString(weekEnd);

    const weekDays = WEEK_DAYS.map((dayName, index) => {
      const date = new Date(weekStart);
      date.setUTCDate(date.getUTCDate() + index);
      return { name: dayName, date: adDateToBsString(date) };
    });
    const weekDayByDate = new Map(weekDays.map((entry) => [entry.date, entry.name]));

    const warningBackEntry = !isFriday;

    let preferredDayName: string | undefined = preferredDay;
    let preferredDateValue: string | undefined;
    if (preferredDate) {
      const preferredDateStr = normalizeToBsDate(String(preferredDate));
      const mappedDay = weekDayByDate.get(preferredDateStr);
      if (!mappedDay) {
        return res.status(400).json({ success: false, message: 'preferredDate must be within the selected week' });
      }
      if (!isValidBsDate(preferredDateStr)) {
        return res.status(400).json({ success: false, message: 'Invalid preferredDate' });
      }
      preferredDateValue = preferredDateStr;
      preferredDayName = mappedDay;
    }

    const request = await WeeklyRequest.create({
      patientId,
      weekStart: weekStartBs,
      weekEnd: weekEndBs,
      callDate: callDateBs,
      requestedUnits,
      requestedHospital,
      preferredDay: preferredDayName,
      preferredDate: preferredDateValue,
      remarks,
      status: WeeklyRequestStatus.PLANNED,
      warningBackEntry,
      createdBy: req.user.userId
    });

    const resolveAssignedDate = (requestDoc: any) => {
      if (requestDoc.preferredDate) {
        return requestDoc.preferredDate;
      }
      if (requestDoc.preferredDay && WEEK_DAYS.includes(requestDoc.preferredDay)) {
        const offset = WEEK_DAYS.indexOf(requestDoc.preferredDay);
        const candidate = new Date(weekStart);
        candidate.setUTCDate(candidate.getUTCDate() + offset);
        return adDateToBsString(candidate);
      }
      return weekStartBs;
    };

    let plan = await WeeklyPlan.findOne({ weekStart: { $gte: weekStartBs, $lte: weekEndBs } });
    if (!plan) {
      plan = await WeeklyPlan.create({
        weekStart: weekStartBs,
        weekEnd: weekEndBs,
        createdBy: req.user.userId
      });

      const requestsForWeek = await WeeklyRequest.find({ weekStart: weekStartBs });
      const items = requestsForWeek.map((reqDoc) => ({
        planId: plan!._id,
        requestId: reqDoc._id,
        patientId: reqDoc.patientId,
        assignedHospital: reqDoc.requestedHospital,
        assignedDate: resolveAssignedDate(reqDoc),
        assignedUnits: reqDoc.requestedUnits
      }));

      if (items.length > 0) {
        await WeeklyPlanItem.insertMany(items);
        await WeeklyRequest.updateMany(
          { weekStart: weekStartBs },
          { $set: { status: WeeklyRequestStatus.PLANNED } }
        );
      }
    } else {
      await WeeklyPlanItem.create({
        planId: plan._id,
        requestId: request._id,
        patientId: request.patientId,
        assignedHospital: request.requestedHospital,
        assignedDate: resolveAssignedDate(request),
        assignedUnits: request.requestedUnits
      });
    }

    if (req.user && req.user.userId) {
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.CREATE,
        resource: AuditResource.SYSTEM,
        resourceId: request._id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Test-Agent',
        details: { action: 'create_weekly_request', patientId, weekStart }
      });
    }

    return res.status(201).json({
      success: true,
      data: { request, warningBackEntry, autoPlanned: true }
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: 'Request already exists for this week' });
    }
    return res.status(400).json({ success: false, message: error.message });
  }
});

// GET /api/weekly-requests - List requests for a week
router.get('/', authorize(UserRole.DATA_ENTRY, UserRole.SUPER_ADMIN), async (req: any, res) => {
  try {
    const { weekStart } = req.query;
    const settings = await loadSettings();

    let range;
    if (weekStart) {
      const weekStartRaw = normalizeToBsDate(String(weekStart));
      if (!isValidBsDate(weekStartRaw)) {
        return res.status(400).json({ success: false, message: 'Invalid weekStart' });
      }
      const parsed = bsToAdDate(weekStartRaw);
      if (!parsed || Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid weekStart' });
      }
      const rangeAd = {
        weekStart: new Date(parsed),
        weekEnd: new Date(parsed)
      };
      rangeAd.weekStart.setUTCHours(0, 0, 0, 0);
      rangeAd.weekEnd.setUTCHours(23, 59, 59, 999);
      rangeAd.weekEnd.setUTCDate(rangeAd.weekEnd.getUTCDate() + 6);
      range = {
        weekStart: adDateToBsString(rangeAd.weekStart),
        weekEnd: adDateToBsString(rangeAd.weekEnd)
      };
    } else {
      const rangeAd = getWeekRange(new Date(), settings.weekStartDay, settings.weekTimeZone);
      range = {
        weekStart: adDateToBsString(rangeAd.weekStart),
        weekEnd: adDateToBsString(rangeAd.weekEnd)
      };
    }

    const requests = await WeeklyRequest.find({
      weekStart: range.weekStart
    }).sort({ created_at: 1 });

    if (req.user && req.user.userId) {
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.READ,
        resource: AuditResource.SYSTEM,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Test-Agent',
        details: { action: 'list_weekly_requests', weekStart: range.weekStart }
      });
    }

    return res.json({ success: true, data: { requests, weekStart: range.weekStart, weekEnd: range.weekEnd } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/weekly-requests/:id - Delete a weekly request
router.delete('/:id', authorize(UserRole.DATA_ENTRY, UserRole.SUPER_ADMIN), async (req: any, res) => {
  try {
    const { id } = req.params;
    const request = await WeeklyRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Weekly request not found' });
    }

    const planItem = await WeeklyPlanItem.findOne({ requestId: request._id });
    if (planItem) {
      const transfusionCount = await TransfusionRecord.countDocuments({ planItemId: planItem._id });
      if (transfusionCount > 0) {
        return res.status(400).json({ success: false, message: 'Cannot delete request with transfusion records' });
      }
      await WeeklyPlanItem.deleteOne({ _id: planItem._id });
    }

    await WeeklyRequest.deleteOne({ _id: id });

    if (req.user && req.user.userId) {
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.DELETE,
        resource: AuditResource.SYSTEM,
        resourceId: request._id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Test-Agent',
        details: { action: 'delete_weekly_request', requestId: id }
      });
    }

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
