import { Router } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { UserRole } from '../models/User.js';
import { TransfusionRecord } from '../models/TransfusionRecord.js';
import { WeeklyPlanItem, WeeklyPlanItemStatus } from '../models/WeeklyPlanItem.js';
import { AuditLog, AuditAction, AuditResource } from '../models/AuditLog.js';

const router = Router();

router.use(authenticate);

// GET /api/transfusion-records?planId=... - List transfusion records (DATA_ENTRY/SUPER_ADMIN)
router.get('/', authorize(UserRole.DATA_ENTRY, UserRole.SUPER_ADMIN), async (req: any, res) => {
  try {
    const { planId } = req.query;

    let query: any = {};
    if (planId) {
      const items = await WeeklyPlanItem.find({ planId }).select('_id');
      const itemIds = items.map((item) => item._id);
      query = { planItemId: { $in: itemIds } };
    }

    const records = await TransfusionRecord.find(query).sort({ actualDate: -1 });

    return res.json({ success: true, data: { records } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/transfusion-records/:id - Delete a transfusion record (SUPER_ADMIN)
router.delete('/:id', authorize(UserRole.SUPER_ADMIN), async (req: any, res) => {
  try {
    const { id } = req.params;
    const record = await TransfusionRecord.findById(id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Transfusion record not found' });
    }

    const item = await WeeklyPlanItem.findById(record.planItemId);
    if (item) {
      item.status = WeeklyPlanItemStatus.SCHEDULED;
      await item.save();
    }

    await TransfusionRecord.deleteOne({ _id: id });

    if (req.user && req.user.userId) {
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.DELETE,
        resource: AuditResource.SYSTEM,
        resourceId: record._id,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Test-Agent',
        details: { action: 'delete_transfusion_record', planItemId: record.planItemId }
      });
    }

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
