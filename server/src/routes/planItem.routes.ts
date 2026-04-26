import { Router } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { UserRole } from '../models/User.js';
import { WeeklyPlanItem } from '../models/WeeklyPlanItem.js';
import { TransfusionRecord, TransfusionOutcome } from '../models/TransfusionRecord.js';
import { AuditLog, AuditAction, AuditResource } from '../models/AuditLog.js';
import { isValidBsDate, normalizeToBsDate } from '../utils/bsDate.js';

const router = Router();

router.use(authenticate);

// PATCH /api/plan-items/:id - Update plan item
router.patch('/:id', authorize(UserRole.DATA_ENTRY, UserRole.SUPER_ADMIN), async (req: any, res) => {
  try {
    const { id } = req.params;
    const update = req.body;

    const item = await WeeklyPlanItem.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Plan item not found' });
    }

    if (update.assignedUnits !== undefined && ![1, 2].includes(Number(update.assignedUnits))) {
      return res.status(400).json({ success: false, message: 'assignedUnits must be 1 or 2' });
    }
    if (update.assignedDate) {
      update.assignedDate = normalizeToBsDate(String(update.assignedDate));
      if (!isValidBsDate(String(update.assignedDate))) {
        return res.status(400).json({ success: false, message: 'Invalid assignedDate' });
      }
    }
    if (update.assignedHospital !== undefined) {
      const hospital = String(update.assignedHospital).trim();
      if (!hospital) {
        return res.status(400).json({ success: false, message: 'assignedHospital is required' });
      }
      update.assignedHospital = hospital;
    }

    Object.assign(item, update);
    await item.save();

    if (req.user && req.user.userId) {
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.UPDATE,
        resource: AuditResource.SYSTEM,
        resourceId: item._id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Test-Agent',
        details: { action: 'update_plan_item', updatedFields: Object.keys(update) }
      });
    }

    return res.json({ success: true, data: { item } });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/plan-items/:id/confirm - Confirm transfusion outcome
router.patch('/:id/confirm', authorize(UserRole.DATA_ENTRY, UserRole.SUPER_ADMIN), async (req: any, res) => {
  try {
    const { id } = req.params;
    const { actualDate, unitsTransfused, outcome, reason, notes } = req.body;

    if (!actualDate || unitsTransfused === undefined || !outcome) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const normalizedActualDate = normalizeToBsDate(String(actualDate));
    if (!isValidBsDate(normalizedActualDate)) {
      return res.status(400).json({ success: false, message: 'Invalid actualDate' });
    }

    if (!Object.values(TransfusionOutcome).includes(outcome)) {
      return res.status(400).json({ success: false, message: 'Invalid outcome' });
    }

    const item = await WeeklyPlanItem.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Plan item not found' });
    }

    const record = await TransfusionRecord.create({
      planItemId: item._id,
      patientId: item.patientId,
      scheduledDate: item.assignedDate,
      actualDate: normalizedActualDate,
      unitsTransfused,
      outcome,
      reason,
      notes,
      createdBy: req.user.userId
    });

    item.status = outcome;
    await item.save();

    if (req.user && req.user.userId) {
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.UPDATE,
        resource: AuditResource.SYSTEM,
        resourceId: item._id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Test-Agent',
        details: { action: 'confirm_transfusion', outcome }
      });
    }

    return res.json({ success: true, data: { record, item } });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
