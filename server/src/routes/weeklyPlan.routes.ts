import { Router } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { UserRole } from '../models/User.js';
import { Settings } from '../models/Settings.js';
import { WeeklyPlan, WeeklyPlanStatus } from '../models/WeeklyPlan.js';
import { WeeklyPlanItem } from '../models/WeeklyPlanItem.js';
import { WeeklyRequest, WeeklyRequestStatus } from '../models/WeeklyRequest.js';
import { Patient } from '../models/Patient.js';
import { TransfusionRecord } from '../models/TransfusionRecord.js';
import { AuditLog, AuditAction, AuditResource } from '../models/AuditLog.js';
import { EmailService } from '../services/EmailService.js';
import { WeeklySummaryService, WeeklySummary } from '../services/WeeklySummaryService.js';
import { getWeekRange } from '../utils/weekUtils.js';
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

async function buildSummary(planId: string): Promise<WeeklySummary> {
  const items = await WeeklyPlanItem.find({ planId });
  const patientIds = [...new Set(items.map((item) => item.patientId.toString()))];
  const patients = await Patient.find({ _id: { $in: patientIds } }).select('_id blood_group');
  const bloodGroupByPatient = new Map(
    patients.map((patient) => [patient._id.toString(), patient.blood_group || 'Unknown'])
  );

  const summary: WeeklySummary = {
    totalUnits: 0,
    byBloodGroup: {},
    byHospital: {},
    byDate: {}
  };

  for (const item of items) {
    const units = item.assignedUnits || 0;
    summary.totalUnits += units;

    const bloodGroup = bloodGroupByPatient.get(item.patientId.toString()) || 'Unknown';
    summary.byBloodGroup[bloodGroup] = (summary.byBloodGroup[bloodGroup] || 0) + units;

    summary.byHospital[item.assignedHospital] =
      (summary.byHospital[item.assignedHospital] || 0) + units;

    const dateKey = item.assignedDate;
    summary.byDate[dateKey] = (summary.byDate[dateKey] || 0) + units;
  }

  return summary;
}

// POST /api/weekly-plans - Create a plan for a week
router.post('/', authorize(UserRole.DATA_ENTRY, UserRole.SUPER_ADMIN), async (req: any, res) => {
  try {
    const { weekStart } = req.body;
    if (!weekStart) {
      return res.status(400).json({ success: false, message: 'weekStart is required' });
    }

    const settings = await loadSettings();
    const weekStartRaw = normalizeToBsDate(weekStart);
    if (!isValidBsDate(weekStartRaw)) {
      return res.status(400).json({ success: false, message: 'Invalid weekStart' });
    }
    const parsed = bsToAdDate(weekStartRaw);
    if (!parsed || Number.isNaN(parsed.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid weekStart' });
    }

    const range = getWeekRange(parsed, settings.weekStartDay, settings.weekTimeZone);
    const weekStartBs = adDateToBsString(range.weekStart);
    const weekEndBs = adDateToBsString(range.weekEnd);

    const existing = await WeeklyPlan.findOne({ weekStart: weekStartBs });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Weekly plan already exists' });
    }

    const plan = await WeeklyPlan.create({
      weekStart: weekStartBs,
      weekEnd: weekEndBs,
      status: WeeklyPlanStatus.DRAFT,
      createdBy: req.user.userId
    });

    const requestWeekStarts = weekStartRaw === weekStartBs
      ? [weekStartBs]
      : [weekStartBs, weekStartRaw];
    const requests = await WeeklyRequest.find({ weekStart: { $in: requestWeekStarts } });

    const items = await WeeklyPlanItem.insertMany(
      requests.map((request) => ({
        planId: plan._id,
        requestId: request._id,
        patientId: request.patientId,
        assignedHospital: request.requestedHospital,
        assignedDate: weekStartBs,
        assignedUnits: request.requestedUnits
      }))
    );

    await WeeklyRequest.updateMany(
      { weekStart: { $in: requestWeekStarts } },
      { $set: { status: WeeklyRequestStatus.PLANNED } }
    );

    if (req.user && req.user.userId) {
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.CREATE,
        resource: AuditResource.SYSTEM,
        resourceId: plan._id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Test-Agent',
        details: { action: 'create_weekly_plan', weekStart: weekStartBs }
      });
    }

    return res.status(201).json({ success: true, data: { plan, items } });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

// GET /api/weekly-plans - List plans (optionally filter by weekStart)
router.get('/', authorize(UserRole.DATA_ENTRY, UserRole.SUPER_ADMIN), async (req: any, res) => {
  try {
    const { weekStart, limit } = req.query;
    const settings = await loadSettings();

    const query: any = {};
    if (weekStart) {
      const weekStartRaw = normalizeToBsDate(String(weekStart));
      if (!isValidBsDate(weekStartRaw)) {
        return res.status(400).json({ success: false, message: 'Invalid weekStart' });
      }
      const parsed = bsToAdDate(weekStartRaw);
      if (!parsed || Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid weekStart' });
      }
      const range = getWeekRange(parsed, settings.weekStartDay, settings.weekTimeZone);
      query.weekStart = adDateToBsString(range.weekStart);
    }

    const take = Math.min(Number(limit) || 20, 50);
    const plans = await WeeklyPlan.find(query)
      .sort({ weekStart: -1 })
      .limit(take);

    return res.json({ success: true, data: { plans } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/weekly-plans/:id - Delete a plan (super admin only)
router.delete('/:id', authorize(UserRole.SUPER_ADMIN), async (req: any, res) => {
  try {
    const { id } = req.params;
    const plan = await WeeklyPlan.findById(id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Weekly plan not found' });
    }

    const items = await WeeklyPlanItem.find({ planId: id });
    const itemIds = items.map((item) => item._id);

    const transfusionCount = await TransfusionRecord.countDocuments({ planItemId: { $in: itemIds } });
    if (transfusionCount > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete plan with transfusion records' });
    }

    // Keep requests planned even if the plan is deleted.

    await WeeklyPlanItem.deleteMany({ planId: id });
    await WeeklyPlan.deleteOne({ _id: id });

    if (req.user && req.user.userId) {
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.DELETE,
        resource: AuditResource.SYSTEM,
        resourceId: plan._id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Test-Agent',
        details: { action: 'delete_weekly_plan', planId: id }
      });
    }

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/weekly-plans/:id - Get plan and items
router.get('/:id', authorize(UserRole.DATA_ENTRY, UserRole.SUPER_ADMIN), async (req: any, res) => {
  try {
    const { id } = req.params;
    const plan = await WeeklyPlan.findById(id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Weekly plan not found' });
    }

    const items = await WeeklyPlanItem.find({ planId: id }).sort({ assignedDate: 1 });

    if (req.user && req.user.userId) {
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.READ,
        resource: AuditResource.SYSTEM,
        resourceId: plan._id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Test-Agent',
        details: { action: 'view_weekly_plan', planId: id }
      });
    }

    return res.json({ success: true, data: { plan, items } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/weekly-plans/:id/summary - Summary by blood group/hospital/date
router.get('/:id/summary', authorize(UserRole.DATA_ENTRY, UserRole.SUPER_ADMIN), async (req: any, res) => {
  try {
    const { id } = req.params;
    const plan = await WeeklyPlan.findById(id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Weekly plan not found' });
    }

    const summary = await buildSummary(id);

    return res.json({ success: true, data: { plan, summary } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/weekly-plans/:id/send-email - Send weekly summary email
router.post('/:id/send-email', authorize(UserRole.DATA_ENTRY, UserRole.SUPER_ADMIN), async (req: any, res) => {
  try {
    const { id } = req.params;
    const plan = await WeeklyPlan.findById(id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Weekly plan not found' });
    }

    const settings = await loadSettings();
    const overrideRecipients = Array.isArray(req.body?.to) ? req.body.to : null;
    const recipients = overrideRecipients || settings.emailRecipients
      .filter((r) => r.active)
      .map((r) => r.email);

    if (!recipients || recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'No email recipients configured' });
    }

    const summary = await buildSummary(id);
    const subject = `Weekly Blood Requirement: ${plan.weekStart} - ${plan.weekEnd}`;
    const textLines = [
      `Week: ${plan.weekStart} - ${plan.weekEnd}`,
      `Total Units: ${summary.totalUnits}`,
      '',
      'By Blood Group:',
      ...Object.entries(summary.byBloodGroup).map(([group, units]) => `${group}: ${units}`),
      '',
      'By Hospital:',
      ...Object.entries(summary.byHospital).map(([hospital, units]) => `${hospital}: ${units}`)
    ];

    const workbookBuffer = await WeeklySummaryService.buildWorkbook(
      summary,
      plan.weekStart,
      plan.weekEnd
    );

    await EmailService.sendMail({
      to: recipients,
      subject,
      text: textLines.join('\n'),
      attachments: [
        {
          filename: `weekly-summary-${plan.weekStart}.xlsx`,
          content: workbookBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }
      ]
    });

    plan.status = WeeklyPlanStatus.SENT;
    plan.sentAt = new Date();
    await plan.save();

    if (req.user && req.user.userId) {
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.UPDATE,
        resource: AuditResource.SYSTEM,
        resourceId: plan._id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Test-Agent',
        details: { action: 'send_weekly_email', recipients }
      });
    }

    return res.json({ success: true, data: { sentAt: plan.sentAt } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
