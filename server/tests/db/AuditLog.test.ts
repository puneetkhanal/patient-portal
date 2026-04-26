import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { AuditLog, AuditAction, AuditResource } from '../../src/models/AuditLog.js';
import { User } from '../../src/models/User.js';
import {
  connectTestDatabase,
  disconnectTestDatabase,
  clearTestDatabase
} from './setup.js';
import {
  createMockAuditLogData,
  bulkCreateAuditLogs,
  getAuditStats
} from './auditTestHelpers.js';

describe('AuditLog Model', () => {
  let testUser: any;

  beforeAll(async () => {
    await connectTestDatabase();

    // Create a test user
    testUser = await User.create({
      email: 'audit-test@example.com',
      name: 'Audit Test User',
      password_hash: 'hashedpassword123',
    });
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe('AuditLog Creation', () => {
    it('should create a new audit log entry', async () => {
      const auditData = createMockAuditLogData({
        userId: testUser._id,
        userEmail: testUser.email,
        action: AuditAction.LOGIN,
        resource: AuditResource.SYSTEM,
      });

      const auditLog = await AuditLog.create(auditData);

      expect(auditLog).toBeDefined();
      expect(auditLog.userId.toString()).toBe(testUser._id.toString());
      expect(auditLog.userEmail).toBe(testUser.email);
      expect(auditLog.action).toBe(AuditAction.LOGIN);
      expect(auditLog.resource).toBe(AuditResource.SYSTEM);
      expect(auditLog.timestamp).toBeDefined();
    });

    it('should create audit log with all required fields', async () => {
      const auditData = {
        userId: testUser._id,
        userEmail: testUser.email,
        userRole: 'super_admin',
        action: AuditAction.CREATE,
        resource: AuditResource.PATIENT,
        resourceId: new mongoose.Types.ObjectId(),
        ipAddress: '192.168.1.100',
        userAgent: 'Test Browser/1.0',
        details: {
          operation: 'create_patient',
          patientId: '12345'
        },
        timestamp: new Date()
      };

      const auditLog = await AuditLog.create(auditData);

      expect(auditLog.userId.toString()).toBe(testUser._id.toString());
      expect(auditLog.userEmail).toBe(testUser.email);
      expect(auditLog.userRole).toBe('super_admin');
      expect(auditLog.action).toBe(AuditAction.CREATE);
      expect(auditLog.resource).toBe(AuditResource.PATIENT);
      expect(auditLog.resourceId).toBeDefined();
      expect(auditLog.ipAddress).toBe('192.168.1.100');
      expect(auditLog.userAgent).toBe('Test Browser/1.0');
      expect(auditLog.details.operation).toBe('create_patient');
    });
  });

  describe('AuditLog Queries', () => {
    beforeEach(async () => {
      // Create multiple audit logs for testing queries
      await bulkCreateAuditLogs(testUser, 10);
    });

    it('should find audit logs by user ID', async () => {
      const userLogs = await AuditLog.find({ userId: testUser._id });

      expect(userLogs.length).toBeGreaterThan(0);
      userLogs.forEach(log => {
        expect(log.userId.toString()).toBe(testUser._id.toString());
      });
    });

    it('should find audit logs by action', async () => {
      const loginLogs = await AuditLog.find({ action: AuditAction.LOGIN });

      expect(loginLogs.length).toBeGreaterThan(0);
      loginLogs.forEach(log => {
        expect(log.action).toBe(AuditAction.LOGIN);
      });
    });

    it('should find audit logs by resource', async () => {
      const systemLogs = await AuditLog.find({ resource: AuditResource.SYSTEM });

      expect(systemLogs.length).toBeGreaterThan(0);
      systemLogs.forEach(log => {
        expect(log.resource).toBe(AuditResource.SYSTEM);
      });
    });

    it('should sort audit logs by timestamp', async () => {
      const logs = await AuditLog.find().sort({ timestamp: -1 });

      expect(logs.length).toBeGreaterThan(1);
      for (let i = 0; i < logs.length - 1; i++) {
        expect(logs[i].timestamp.getTime()).toBeGreaterThanOrEqual(logs[i + 1].timestamp.getTime());
      }
    });
  });

  describe('Audit Statistics', () => {
    beforeEach(async () => {
      await bulkCreateAuditLogs(testUser, 20);
    });

    it('should generate correct audit statistics', async () => {
      const stats = await getAuditStats();

      expect(stats.total).toBeGreaterThan(0);
      expect(stats.byAction).toBeDefined();
      expect(stats.byResource).toBeDefined();
      expect(stats.byRole).toBeDefined();

      // Verify that stats add up to total
      const actionTotal = Object.values(stats.byAction).reduce((sum, count) => sum + count, 0);
      const resourceTotal = Object.values(stats.byResource).reduce((sum, count) => sum + count, 0);
      const roleTotal = Object.values(stats.byRole).reduce((sum, count) => sum + count, 0);

      expect(actionTotal).toBe(stats.total);
      expect(resourceTotal).toBe(stats.total);
      expect(roleTotal).toBe(stats.total);
    });
  });

  describe('AuditLog Validation', () => {
    it('should require userId', async () => {
      const auditData = createMockAuditLogData({
        userId: undefined as any,
      });

      await expect(AuditLog.create(auditData)).rejects.toThrow();
    });

    it('should require userEmail', async () => {
      const auditData = createMockAuditLogData({
        userEmail: '',
      });

      await expect(AuditLog.create(auditData)).rejects.toThrow();
    });

    it('should require action', async () => {
      const auditData = createMockAuditLogData({
        action: undefined as any,
      });

      await expect(AuditLog.create(auditData)).rejects.toThrow();
    });

    it('should require resource', async () => {
      const auditData = createMockAuditLogData({
        resource: undefined as any,
      });

      await expect(AuditLog.create(auditData)).rejects.toThrow();
    });

    it('should validate enum values for action', async () => {
      const auditData = createMockAuditLogData({
        action: 'invalid_action' as any,
      });

      await expect(AuditLog.create(auditData)).rejects.toThrow();
    });

    it('should validate enum values for resource', async () => {
      const auditData = createMockAuditLogData({
        resource: 'invalid_resource' as any,
      });

      await expect(AuditLog.create(auditData)).rejects.toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should handle bulk operations efficiently', async () => {
      // Clear any existing logs first
      await AuditLog.deleteMany({});

      const startTime = Date.now();

      await bulkCreateAuditLogs(testUser, 100);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds

      const totalLogs = await AuditLog.countDocuments();
      expect(totalLogs).toBe(100);
    });
  });
});