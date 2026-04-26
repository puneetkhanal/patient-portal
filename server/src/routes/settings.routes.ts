import { Router } from 'express';
import { authenticate, authorize } from '../auth/middleware.js';
import { UserRole } from '../models/User.js';
import { Settings } from '../models/Settings.js';
import { AuditLog, AuditAction, AuditResource } from '../models/AuditLog.js';

const router = Router();

router.use(authenticate);

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function validateSettingsPayload(payload: any): string | null {
  if (payload.weekStartDay && !WEEK_DAYS.includes(payload.weekStartDay)) {
    return 'Invalid weekStartDay';
  }
  if (payload.calendarMode && !['AD', 'BS'].includes(payload.calendarMode)) {
    return 'Invalid calendarMode';
  }
  if (payload.backEntryWarningDays !== undefined && payload.backEntryWarningDays < 0) {
    return 'backEntryWarningDays must be >= 0';
  }
  if (payload.hospitalList && !Array.isArray(payload.hospitalList)) {
    return 'hospitalList must be an array of strings';
  }
  if (payload.hospitalCapacities && !Array.isArray(payload.hospitalCapacities)) {
    return 'hospitalCapacities must be an array';
  }
  if (payload.hospitalCapacities) {
    for (const entry of payload.hospitalCapacities) {
      if (!entry || typeof entry.name !== 'string') {
        return 'hospitalCapacities entries must include a hospital name';
      }
      if (entry.slots && typeof entry.slots !== 'object') {
        return 'hospitalCapacities slots must be an object';
      }
      if (entry.slots) {
        for (const day of WEEK_DAYS) {
          const value = entry.slots[day];
          if (value === undefined || value === null) {
            continue;
          }
          if (typeof value !== 'number' || Number.isNaN(value)) {
            return `hospitalCapacities slots for ${day} must be a number`;
          }
          if (value < 0) {
            return `hospitalCapacities slots for ${day} must be >= 0`;
          }
        }
      }
    }
  }
  if (payload.bloodGroups && !Array.isArray(payload.bloodGroups)) {
    return 'bloodGroups must be an array of strings';
  }
  if (payload.emailRecipients && !Array.isArray(payload.emailRecipients)) {
    return 'emailRecipients must be an array';
  }
  return null;
}

// GET /api/settings - Get settings (data entry or super admin)
router.get('/', authorize(UserRole.SUPER_ADMIN, UserRole.DATA_ENTRY), async (req: any, res) => {
  try {
    let settings = await Settings.findOne({});
    if (!settings) {
      // Create settings with default values by not providing any data
      settings = new Settings();
      await settings.save();
    }

    if (req.user && req.user.userId) {
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.READ,
        resource: AuditResource.SYSTEM,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Test-Agent',
        details: { action: 'view_settings' }
      });
    }

    return res.json({ success: true, data: { settings } });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/settings - Update settings (super admin only)
router.put('/', authorize(UserRole.SUPER_ADMIN), async (req: any, res) => {
  try {
    const validationError = validateSettingsPayload(req.body);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const settings = await Settings.findOneAndUpdate(
      {},
      { $set: req.body },
      { new: true, upsert: true }
    );

    if (req.user && req.user.userId) {
      await AuditLog.create({
        userId: req.user.userId,
        userEmail: req.user.email,
        userRole: req.user.role,
        action: AuditAction.UPDATE,
        resource: AuditResource.SYSTEM,
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.get('User-Agent') || 'Test-Agent',
        details: { action: 'update_settings', updatedFields: Object.keys(req.body) }
      });
    }

    return res.json({ success: true, data: { settings } });
  } catch (error: any) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

export default router;
