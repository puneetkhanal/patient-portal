// tests/utils/auditTestHelpers.ts
import mongoose from 'mongoose';
import { AuditLog, AuditAction, AuditResource } from '../../src/models/AuditLog.js';

/**
 * Generate mock audit log data for testing
 */
export const createMockAuditLogData = (overrides = {}) => {
  const userId = new mongoose.Types.ObjectId();
  const baseData = {
    userId,
    userEmail: 'test@example.com',
    userRole: 'super_admin',
    action: AuditAction.LOGIN,
    resource: AuditResource.SYSTEM,
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    details: { test: 'data' },
    timestamp: new Date()
  };

  return { ...baseData, ...overrides };
};

/**
 * Bulk create audit logs for performance testing
 */
export const bulkCreateAuditLogs = async (
  user: any,
  count: number,
  options?: {
    startDate?: Date;
    endDate?: Date;
  }
): Promise<void> => {
  const actions = Object.values(AuditAction);
  const resources = Object.values(AuditResource);

  const logs = [];
  const startDate = options?.startDate || new Date('2024-01-01');
  const timeIncrement = options?.endDate
    ? (options.endDate.getTime() - startDate.getTime()) / count
    : 24 * 60 * 60 * 1000; // 1 day per log

  for (let i = 0; i < count; i++) {
    logs.push({
      userId: user._id,
      userEmail: user.email,
      userRole: i % 4 === 0 ? 'super_admin' :
                i % 4 === 1 ? 'data_entry' :
                i % 4 === 2 ? 'medical_reviewer' : 'analyst',
      action: actions[i % actions.length],
      resource: resources[i % resources.length],
      ipAddress: `192.168.1.${i % 256}`,
      userAgent: `TestAgent/${i + 1}`,
      details: {
        index: i,
        timestamp: new Date().toISOString(),
        operation: `operation_${i}`
      },
      timestamp: new Date(startDate.getTime() + i * timeIncrement)
    });
  }

  await AuditLog.insertMany(logs);
};

/**
 * Get audit statistics for assertions
 */
export const getAuditStats = async (): Promise<{
  total: number;
  byAction: Record<string, number>;
  byResource: Record<string, number>;
  byRole: Record<string, number>;
}> => {
  const [total, actionStats, resourceStats, roleStats] = await Promise.all([
    AuditLog.countDocuments(),
    AuditLog.aggregate([{ $group: { _id: '$action', count: { $sum: 1 } } }]),
    AuditLog.aggregate([{ $group: { _id: '$resource', count: { $sum: 1 } } }]),
    AuditLog.aggregate([{ $group: { _id: '$userRole', count: { $sum: 1 } } }])
  ]);

  return {
    total,
    byAction: actionStats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {}),
    byResource: resourceStats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {}),
    byRole: roleStats.reduce((acc, stat) => {
      acc[stat._id] = stat.count;
      return acc;
    }, {})
  };
};