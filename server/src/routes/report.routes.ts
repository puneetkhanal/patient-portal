import { Router } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { UserRole } from '../models/User.js';
import { Patient } from '../models/Patient.js';
import { WeeklyRequest } from '../models/WeeklyRequest.js';
import { TransfusionRecord } from '../models/TransfusionRecord.js';
import { bsToAdDate } from '../utils/bsDate.js';

const router = Router();

router.use(authenticate);

function getFrequencyCategory(avgIntervalDays: number | null): string {
  if (!avgIntervalDays) return 'irregular';
  if (avgIntervalDays <= 10) return 'weekly';
  if (avgIntervalDays <= 20) return 'bi-weekly';
  if (avgIntervalDays <= 40) return 'monthly';
  return 'irregular';
}

// GET /api/reports/transfusion-frequency
router.get('/transfusion-frequency', authorize(UserRole.ANALYST, UserRole.SUPER_ADMIN), async (req: any, res) => {
  try {
    const records = await TransfusionRecord.find({})
      .sort({ patientId: 1, actualDate: 1 })
      .lean();

    const byPatient: Record<string, typeof records> = {};
    for (const record of records) {
      const key = record.patientId.toString();
      if (!byPatient[key]) byPatient[key] = [];
      byPatient[key].push(record);
    }

    const patientIds = Object.keys(byPatient);
    const patients = await Patient.find({ _id: { $in: patientIds } })
      .select('_id patient_name registered_no')
      .lean();
    const patientMap = new Map(patients.map((p) => [p._id.toString(), p]));

    const results = patientIds.map((patientId) => {
      const list = byPatient[patientId];
      let totalUnits = 0;
      let lastDate: string | null = null;
      const intervals: number[] = [];

      for (let i = 0; i < list.length; i++) {
        const rec = list[i];
        totalUnits += rec.unitsTransfused || 0;
        if (rec.actualDate) lastDate = rec.actualDate;
        if (i > 0 && rec.actualDate && list[i - 1].actualDate) {
          const current = bsToAdDate(rec.actualDate);
          const prev = bsToAdDate(list[i - 1].actualDate);
          if (current && prev) {
            const diff = (current.getTime() - prev.getTime()) / 86400000;
            intervals.push(diff);
          }
        }
      }

      const avgInterval = intervals.length
        ? intervals.reduce((a, b) => a + b, 0) / intervals.length
        : null;

      const category = getFrequencyCategory(avgInterval);
      const patient = patientMap.get(patientId);

      const base = {
        patientId,
        totalTransfusions: list.length,
        totalUnits,
        lastTransfusionDate: lastDate,
        averageIntervalDays: avgInterval,
        frequencyCategory: category
      };

      if (req.user.role === UserRole.ANALYST) {
        return base;
      }

      return {
        ...base,
        patient_name: patient?.patient_name,
        registered_no: patient?.registered_no
      };
    });

    return res.json({ success: true, data: { results } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reports/shortage
router.get('/shortage', authorize(UserRole.ANALYST, UserRole.SUPER_ADMIN), async (_req, res) => {
  try {
    const requested = await WeeklyRequest.aggregate([
      { $group: { _id: '$weekStart', requestedUnits: { $sum: '$requestedUnits' } } }
    ]);

    const transfused = await TransfusionRecord.aggregate([
      {
        $lookup: {
          from: 'weeklyplanitems',
          localField: 'planItemId',
          foreignField: '_id',
          as: 'item'
        }
      },
      { $unwind: '$item' },
      {
        $lookup: {
          from: 'weeklyplans',
          localField: 'item.planId',
          foreignField: '_id',
          as: 'plan'
        }
      },
      { $unwind: '$plan' },
      { $group: { _id: '$plan.weekStart', transfusedUnits: { $sum: '$unitsTransfused' } } }
    ]);

    const transfusedMap = new Map(transfused.map((t) => [t._id, t.transfusedUnits]));

    const results = requested.map((r) => {
      const weekStart = r._id;
      const requestedUnits = r.requestedUnits || 0;
      const transfusedUnits = transfusedMap.get(weekStart) || 0;
      return {
        weekStart,
        requestedUnits,
        transfusedUnits,
        shortageUnits: Math.max(0, requestedUnits - transfusedUnits)
      };
    });

    return res.json({ success: true, data: { results } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/reports/hospital-load
router.get('/hospital-load', authorize(UserRole.ANALYST, UserRole.SUPER_ADMIN), async (_req, res) => {
  try {
    const hospitalTotals = await TransfusionRecord.aggregate([
      {
        $lookup: {
          from: 'weeklyplanitems',
          localField: 'planItemId',
          foreignField: '_id',
          as: 'item'
        }
      },
      { $unwind: '$item' },
      {
        $group: {
          _id: '$item.assignedHospital',
          totalUnits: { $sum: '$unitsTransfused' },
          transfusionCount: { $sum: 1 }
        }
      },
      { $sort: { totalUnits: -1 } }
    ]);

    const peakDays = await TransfusionRecord.aggregate([
      {
        $group: {
          _id: '$actualDate',
          totalUnits: { $sum: '$unitsTransfused' }
        }
      },
      { $sort: { totalUnits: -1 } },
      { $limit: 5 }
    ]);

    return res.json({
      success: true,
      data: {
        hospitalTotals: hospitalTotals.map((h) => ({
          hospital: h._id,
          totalUnits: h.totalUnits,
          transfusionCount: h.transfusionCount
        })),
        peakDays: peakDays.map((d) => ({ date: d._id, totalUnits: d.totalUnits }))
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
