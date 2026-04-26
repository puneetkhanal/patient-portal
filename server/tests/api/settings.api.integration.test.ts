import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app.js';
import { User, UserRole } from '../../src/models/User.js';
import { Settings } from '../../src/models/Settings.js';
import bcrypt from 'bcryptjs';

let app: any;
let mongoServer: MongoMemoryServer;
let adminToken: string;
let userToken: string;

describe('Settings API Integration Tests', () => {
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
    await Settings.deleteMany({});

    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    await mongoose.connection.db.collection('users').insertMany([
      {
        email: 'admin@example.com',
        name: 'Admin User',
        password_hash: hashedPassword,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'user@example.com',
        name: 'Regular User',
        password_hash: hashedPassword,
        role: UserRole.DATA_ENTRY,
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    const login = async (email: string) => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'testpassword123' });

      expect(response.status).toBe(200);
      return response.body.token;
    };

    adminToken = await login('admin@example.com');
    userToken = await login('user@example.com');
  });

  describe('GET /api/settings', () => {
    it('should allow super admin to fetch settings with defaults', async () => {
      const response = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.settings.weekStartDay).toBe('Sunday');
      expect(response.body.data.settings.weekTimeZone).toBe('Asia/Kathmandu');
      expect(response.body.data.settings.calendarMode).toBe('BS');
    });

    it('should allow data entry to fetch settings', async () => {
      const response = await request(app)
        .get('/api/settings')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.settings.weekStartDay).toBe('Sunday');
      expect(response.body.data.settings.calendarMode).toBe('BS');
    });
  });

  describe('PUT /api/settings', () => {
    it('should allow super admin to update settings', async () => {
      const response = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          weekStartDay: 'Monday',
          calendarMode: 'BS',
          allowBackEntry: false,
          backEntryWarningDays: 3,
          hospitalList: ['General Hospital', 'Community Hospital', 'Regional Hospital']
        });

      expect(response.status).toBe(200);
      expect(response.body.data.settings.weekStartDay).toBe('Monday');
      expect(response.body.data.settings.calendarMode).toBe('BS');
      expect(response.body.data.settings.allowBackEntry).toBe(false);
      expect(response.body.data.settings.backEntryWarningDays).toBe(3);
      expect(response.body.data.settings.hospitalList.length).toBe(3);
    });

    it('should reject invalid weekStartDay', async () => {
      const response = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ weekStartDay: 'Funday' });

      expect(response.status).toBe(400);
    });
  });
});
