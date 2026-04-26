import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app.js';
import { User, UserRole } from '../../src/models/User.js';
import bcrypt from 'bcryptjs';

let app: any;
let mongoServer: MongoMemoryServer;
let adminToken: string;
let userToken: string;

describe('User Management API Integration Tests', () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUrl = mongoServer.getUri();

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUrl);
    }

    app = createApp();
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  }, 30000);

  beforeEach(async () => {
    await User.deleteMany({});

    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    const users = [
      {
        email: 'admin@example.com',
        name: 'Admin User',
        password_hash: hashedPassword,
        role: UserRole.SUPER_ADMIN
      },
      {
        email: 'user@example.com',
        name: 'Regular User',
        password_hash: hashedPassword,
        role: UserRole.DATA_ENTRY
      }
    ];

    await mongoose.connection.db.collection('users').insertMany(
      users.map((user) => ({
        ...user,
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      }))
    );

    const login = async (email: string) => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email,
          password: 'testpassword123'
        });

      expect(response.status).toBe(200);
      return response.body.token;
    };

    adminToken = await login('admin@example.com');
    userToken = await login('user@example.com');
  });

  describe('POST /api/users', () => {
    it('should allow super admin to create a new user with temp password', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newuser@example.com',
          name: 'New User',
          role: 'medical_reviewer',
          tempPassword: 'temp1234'
        });

      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(response.body.user.role).toBe('medical_reviewer');
      expect(response.body.user.mustChangePassword).toBe(true);
    });

    it('should reject user creation by non-admin', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: 'newuser@example.com',
          name: 'New User',
          role: 'data_entry',
          tempPassword: 'temp1234'
        });

      expect(response.status).toBe(403);
    });

    it('should reject invalid role', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newuser@example.com',
          name: 'New User',
          role: 'invalid_role',
          tempPassword: 'temp1234'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid role');
    });

    it('should reject missing fields', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newuser@example.com',
          role: 'data_entry'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject short temp password', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newuser@example.com',
          name: 'New User',
          role: 'data_entry',
          tempPassword: '123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least 6');
    });

    it('should reject duplicate email', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'admin@example.com',
          name: 'Duplicate Admin',
          role: 'data_entry',
          tempPassword: 'temp1234'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .send({
          currentPassword: 'testpassword123',
          newPassword: 'newpass123'
        });

      expect(response.status).toBe(401);
    });

    it('should reject incorrect current password', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpass123'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('incorrect');
    });

    it('should allow user to change password and clear mustChangePassword', async () => {
      // create new user with temp password
      const createResponse = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'tempuser@example.com',
          name: 'Temp User',
          role: 'data_entry',
          tempPassword: 'temp1234'
        });

      expect(createResponse.status).toBe(201);

      // login with temp password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'tempuser@example.com',
          password: 'temp1234'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.user.mustChangePassword).toBe(true);

      const tempToken = loginResponse.body.token;

      // change password
      const changeResponse = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${tempToken}`)
        .send({
          currentPassword: 'temp1234',
          newPassword: 'newpass123'
        });

      expect(changeResponse.status).toBe(200);
      expect(changeResponse.body.user.mustChangePassword).toBe(false);

      // verify login with new password
      const relogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'tempuser@example.com',
          password: 'newpass123'
        });

      expect(relogin.status).toBe(200);
    });
  });

  describe('PATCH /api/users/:id/deactivate', () => {
    it('should allow super admin to deactivate user', async () => {
      const targetUser = await User.findOne({ email: 'user@example.com' });
      expect(targetUser).toBeTruthy();

      const response = await request(app)
        .patch(`/api/users/${targetUser?._id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.isActive).toBe(false);

      const updated = await User.findById(targetUser?._id);
      expect(updated?.isActive).toBe(false);
    });

    it('should reject deactivation by non-admin', async () => {
      const targetUser = await User.findOne({ email: 'user@example.com' });
      expect(targetUser).toBeTruthy();

      const response = await request(app)
        .patch(`/api/users/${targetUser?._id}/deactivate`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });

    it('should not allow deactivating super admin', async () => {
      const adminUser = await User.findOne({ email: 'admin@example.com' });
      expect(adminUser).toBeTruthy();

      const response = await request(app)
        .patch(`/api/users/${adminUser?._id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cannot deactivate super admin');
    });

    it('should prevent deactivated user from logging in', async () => {
      const targetUser = await User.findOne({ email: 'user@example.com' });
      expect(targetUser).toBeTruthy();

      await request(app)
        .patch(`/api/users/${targetUser?._id}/deactivate`)
        .set('Authorization', `Bearer ${adminToken}`);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'testpassword123'
        });

      expect(loginResponse.status).toBe(403);
      expect(loginResponse.body.error).toContain('deactivated');
    });
  });
});
