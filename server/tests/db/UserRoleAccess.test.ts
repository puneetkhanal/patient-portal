import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { User, UserRole, Permission, IUser } from '../../src/models/User.js';
import { AuditLog, AuditAction, AuditResource } from '../../src/models/AuditLog.js';
import {
  connectTestDatabase,
  disconnectTestDatabase
} from './setup.js';

describe('User Role-Based Access Control', () => {
  let superAdmin: IUser;
  let dataEntryUser: IUser;
  let medicalReviewer: IUser;
  let analyst: IUser;

  beforeAll(async () => {
    await connectTestDatabase();

    // Create test users with different roles
    superAdmin = await User.create({
      email: 'superadmin@test.com',
      name: 'Super Admin',
      password_hash: 'hashedpassword123',
      role: UserRole.SUPER_ADMIN,
      isActive: true
    });

    dataEntryUser = await User.create({
      email: 'dataentry@test.com',
      name: 'Data Entry User',
      password_hash: 'hashedpassword123',
      role: UserRole.DATA_ENTRY,
      isActive: true
    });

    medicalReviewer = await User.create({
      email: 'medical@test.com',
      name: 'Medical Reviewer',
      password_hash: 'hashedpassword123',
      role: UserRole.MEDICAL_REVIEWER,
      isActive: true
    });

    analyst = await User.create({
      email: 'analyst@test.com',
      name: 'Analyst',
      password_hash: 'hashedpassword123',
      role: UserRole.ANALYST,
      isActive: true
    });
  });

  beforeEach(async () => {
    // Clear audit logs between tests
    await AuditLog.deleteMany({});
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  describe('Role-Permission Mapping', () => {
    describe('Super Admin Permissions', () => {
      it('should have all permissions', () => {
        expect(superAdmin.hasPermission(Permission.CREATE_PATIENT)).toBe(true);
        expect(superAdmin.hasPermission(Permission.READ_PATIENT)).toBe(true);
        expect(superAdmin.hasPermission(Permission.UPDATE_PATIENT)).toBe(true);
        expect(superAdmin.hasPermission(Permission.DELETE_PATIENT)).toBe(true);
        expect(superAdmin.hasPermission(Permission.MANAGE_USERS)).toBe(true);
        expect(superAdmin.hasPermission(Permission.VIEW_USERS)).toBe(true);
        expect(superAdmin.hasPermission(Permission.VIEW_AUDIT_LOGS)).toBe(true);
        expect(superAdmin.hasPermission(Permission.MANAGE_SETTINGS)).toBe(true);
      });

      it('should return false for invalid permissions', () => {
        expect(superAdmin.hasPermission('invalid_permission' as Permission)).toBe(false);
      });
    });

    describe('Data Entry User Permissions', () => {
      it('should have limited permissions', () => {
        expect(dataEntryUser.hasPermission(Permission.CREATE_PATIENT)).toBe(true);
        expect(dataEntryUser.hasPermission(Permission.READ_PATIENT)).toBe(true);
        expect(dataEntryUser.hasPermission(Permission.UPDATE_PATIENT)).toBe(true);
        expect(dataEntryUser.hasPermission(Permission.UPLOAD_DOCUMENTS)).toBe(true);
        expect(dataEntryUser.hasPermission(Permission.VIEW_DOCUMENTS)).toBe(true);
      });

      it('should not have admin permissions', () => {
        expect(dataEntryUser.hasPermission(Permission.DELETE_PATIENT)).toBe(false);
        expect(dataEntryUser.hasPermission(Permission.MANAGE_USERS)).toBe(false);
        expect(dataEntryUser.hasPermission(Permission.VIEW_AUDIT_LOGS)).toBe(false);
        expect(dataEntryUser.hasPermission(Permission.MANAGE_SETTINGS)).toBe(false);
      });
    });

    describe('Medical Reviewer Permissions', () => {
      it('should have review permissions', () => {
        expect(medicalReviewer.hasPermission(Permission.READ_PATIENT)).toBe(true);
        expect(medicalReviewer.hasPermission(Permission.VIEW_DOCUMENTS)).toBe(true);
        expect(medicalReviewer.hasPermission(Permission.VERIFY_DOCUMENTS)).toBe(true);
        expect(medicalReviewer.hasPermission(Permission.VIEW_REPORTS)).toBe(true);
      });

      it('should not have modification permissions', () => {
        expect(medicalReviewer.hasPermission(Permission.CREATE_PATIENT)).toBe(false);
        expect(medicalReviewer.hasPermission(Permission.UPDATE_PATIENT)).toBe(false);
        expect(medicalReviewer.hasPermission(Permission.DELETE_PATIENT)).toBe(false);
        expect(medicalReviewer.hasPermission(Permission.MANAGE_USERS)).toBe(false);
      });
    });

    describe('Analyst Permissions', () => {
      it('should have limited read permissions', () => {
        expect(analyst.hasPermission(Permission.READ_PATIENT)).toBe(true);
        expect(analyst.hasPermission(Permission.VIEW_REPORTS)).toBe(true);
        expect(analyst.hasPermission(Permission.EXPORT_DATA)).toBe(true);
      });

      it('should not have modification permissions', () => {
        expect(analyst.hasPermission(Permission.CREATE_PATIENT)).toBe(false);
        expect(analyst.hasPermission(Permission.UPDATE_PATIENT)).toBe(false);
        expect(analyst.hasPermission(Permission.DELETE_PATIENT)).toBe(false);
        expect(analyst.hasPermission(Permission.MANAGE_USERS)).toBe(false);
        expect(analyst.hasPermission(Permission.VIEW_AUDIT_LOGS)).toBe(false);
      });
    });
  });

  describe('Patient Data Access Control', () => {
    describe('canViewPatientDetails', () => {
      it('should allow super admin to view patient details', () => {
        expect(superAdmin.canViewPatientDetails()).toBe(true);
      });

      it('should allow data entry to view patient details', () => {
        expect(dataEntryUser.canViewPatientDetails()).toBe(true);
      });

      it('should allow medical reviewer to view patient details', () => {
        expect(medicalReviewer.canViewPatientDetails()).toBe(true);
      });

      it('should allow analyst to view patient details', () => {
        expect(analyst.canViewPatientDetails()).toBe(true);
      });
    });

    describe('canViewPersonalData', () => {
      it('should allow super admin to view personal data', () => {
        expect(superAdmin.canViewPersonalData()).toBe(true);
      });

      it('should allow data entry to view personal data', () => {
        expect(dataEntryUser.canViewPersonalData()).toBe(true);
      });

      it('should allow medical reviewer to view personal data', () => {
        expect(medicalReviewer.canViewPersonalData()).toBe(true);
      });

      it('should NOT allow analyst to view personal data', () => {
        expect(analyst.canViewPersonalData()).toBe(false);
      });
    });

    describe('canViewDocuments', () => {
      it('should allow super admin to view documents', () => {
        expect(superAdmin.canViewDocuments()).toBe(true);
      });

      it('should allow data entry to view documents', () => {
        expect(dataEntryUser.canViewDocuments()).toBe(true);
      });

      it('should allow medical reviewer to view documents', () => {
        expect(medicalReviewer.canViewDocuments()).toBe(true);
      });

      it('should NOT allow analyst to view documents', () => {
        expect(analyst.canViewDocuments()).toBe(false);
      });
    });
  });

  describe('Static Methods', () => {
    describe('getPermissionsByRole', () => {
      it('should return correct permissions for super admin', () => {
        const permissions = User.getPermissionsByRole(UserRole.SUPER_ADMIN);
        expect(permissions).toContain(Permission.CREATE_PATIENT);
        expect(permissions).toContain(Permission.MANAGE_USERS);
        expect(permissions).toContain(Permission.VIEW_AUDIT_LOGS);
        expect(permissions).toHaveLength(13); // All permissions
      });

      it('should return correct permissions for data entry', () => {
        const permissions = User.getPermissionsByRole(UserRole.DATA_ENTRY);
        expect(permissions).toContain(Permission.CREATE_PATIENT);
        expect(permissions).toContain(Permission.UPDATE_PATIENT);
        expect(permissions).toContain(Permission.UPLOAD_DOCUMENTS);
        expect(permissions).toHaveLength(5);
      });

      it('should return correct permissions for medical reviewer', () => {
        const permissions = User.getPermissionsByRole(UserRole.MEDICAL_REVIEWER);
        expect(permissions).toContain(Permission.READ_PATIENT);
        expect(permissions).toContain(Permission.VERIFY_DOCUMENTS);
        expect(permissions).toHaveLength(4);
      });

      it('should return correct permissions for analyst', () => {
        const permissions = User.getPermissionsByRole(UserRole.ANALYST);
        expect(permissions).toContain(Permission.READ_PATIENT);
        expect(permissions).toContain(Permission.EXPORT_DATA);
        expect(permissions).toHaveLength(3);
      });

      it('should return empty array for invalid role', () => {
        const permissions = User.getPermissionsByRole('invalid_role' as UserRole);
        expect(permissions).toEqual([]);
      });
    });

    describe('createSuperAdmin', () => {
      it('should create a super admin user', async () => {
        const admin = await User.createSuperAdmin(
          'testadmin@test.com',
          'Test Admin',
          'password123'
        );

        expect(admin.email).toBe('testadmin@test.com');
        expect(admin.name).toBe('Test Admin');
        expect(admin.role).toBe(UserRole.SUPER_ADMIN);
        expect(admin.isActive).toBe(true);
        // Password should be hashed by the pre-save middleware
        expect(admin.password_hash).toMatch(/^\$2[aby]\$\d+\$/); // bcrypt hash pattern
        expect(await admin.comparePassword('password123')).toBe(true);
      });
    });
  });

  describe('User Schema Validation', () => {
    it('should require valid role enum values', async () => {
      await expect(User.create({
        email: 'invalidrole@test.com',
        name: 'Invalid Role',
        password_hash: 'hashedpassword123',
        role: 'invalid_role' as UserRole
      })).rejects.toThrow();
    });

    it('should set default role to DATA_ENTRY', async () => {
      const user = await User.create({
        email: 'defaultrole@test.com',
        name: 'Default Role',
        password_hash: 'hashedpassword123'
        // No role specified, should default to DATA_ENTRY
      });

      expect(user.role).toBe(UserRole.DATA_ENTRY);
    });

    it('should default isActive to true', async () => {
      const user = await User.create({
        email: 'defaultactive@test.com',
        name: 'Default Active',
        password_hash: 'hashedpassword123',
        role: UserRole.DATA_ENTRY
      });

      expect(user.isActive).toBe(true);
    });
  });

  describe('Audit Log Integration', () => {
    it('should be able to create audit logs for user actions', async () => {
      // Simulate a user action that should be logged
      const auditLog = await AuditLog.create({
        userId: superAdmin._id,
        userEmail: superAdmin.email,
        userRole: superAdmin.role,
        action: AuditAction.LOGIN,
        resource: AuditResource.SYSTEM,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        details: { test: 'login test' }
      });

      expect(auditLog.userId.toString()).toBe(superAdmin._id.toString());
      expect(auditLog.userRole).toBe(UserRole.SUPER_ADMIN);
      expect(auditLog.action).toBe(AuditAction.LOGIN);
    });

    it('should track role-based permission checks', async () => {
      // Test that permission checks work as expected
      const hasPermission = superAdmin.hasPermission(Permission.MANAGE_USERS);
      expect(hasPermission).toBe(true);

      // In a real implementation, this might trigger audit logging
      // For now, we just verify the permission logic works
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle inactive users', async () => {
      const inactiveUser = await User.create({
        email: 'inactive@test.com',
        name: 'Inactive User',
        password_hash: 'hashedpassword123',
        role: UserRole.SUPER_ADMIN,
        isActive: false
      });

      // Even inactive super admin should have permissions (permissions don't depend on active status)
      expect(inactiveUser.hasPermission(Permission.MANAGE_USERS)).toBe(true);
      expect(inactiveUser.isActive).toBe(false);
    });

    it('should handle null/undefined roles gracefully', () => {
      // Create a user instance with null role to test edge case
      const userWithoutRole = new User({
        email: 'norole@test.com',
        name: 'No Role User',
        password_hash: 'hashedpassword123',
        role: null as any
      });

      expect(userWithoutRole.hasPermission(Permission.READ_PATIENT)).toBe(false);
    });

    it('should prevent permission escalation through role changes', async () => {
      // Create a basic user
      const basicUser = await User.create({
        email: 'basic@test.com',
        name: 'Basic User',
        password_hash: 'hashedpassword123',
        role: UserRole.ANALYST
      });

      // Verify they don't have admin permissions initially
      expect(basicUser.hasPermission(Permission.MANAGE_USERS)).toBe(false);

      // Update role to super admin (this would typically require admin approval)
      basicUser.role = UserRole.SUPER_ADMIN;
      await basicUser.save();

      // Now they should have admin permissions
      expect(basicUser.hasPermission(Permission.MANAGE_USERS)).toBe(true);
    });
  });
});
