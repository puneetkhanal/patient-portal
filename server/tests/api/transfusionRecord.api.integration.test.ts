import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app.js';
import { User, UserRole } from '../../src/models/User.js';
import { Patient } from '../../src/models/Patient.js';
import { WeeklyPlan } from '../../src/models/WeeklyPlan.js';
import { WeeklyPlanItem, WeeklyPlanItemStatus } from '../../src/models/WeeklyPlanItem.js';
import { TransfusionRecord } from '../../src/models/TransfusionRecord.js';
import bcrypt from 'bcryptjs';
import { toBs } from '../utils/bsDate.js';

let app: any;
let mongoServer: MongoMemoryServer;
let dataEntryToken: string;
let adminToken: string;
let analystToken: string;
let planId: string;
let itemId: string;
let recordId: string;

describe('Transfusion Record API Integration Tests', () => {
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
    await Patient.deleteMany({});
    await WeeklyPlan.deleteMany({});
    await WeeklyPlanItem.deleteMany({});
    await TransfusionRecord.deleteMany({});

    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    await mongoose.connection.db.collection('users').insertMany([
      {
        email: 'data@example.com',
        name: 'Data Entry',
        password_hash: hashedPassword,
        role: UserRole.DATA_ENTRY,
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'admin@example.com',
        name: 'Admin',
        password_hash: hashedPassword,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        email: 'analyst@example.com',
        name: 'Analyst',
        password_hash: hashedPassword,
        role: UserRole.ANALYST,
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

    dataEntryToken = await login('data@example.com');
    adminToken = await login('admin@example.com');
    analystToken = await login('analyst@example.com');

    const patient = await Patient.create({
      registered_date: toBs('2024-01-15'),
      registered_no: 'PAT500',
      patient_name: 'Transfusion Patient',
      diagnosed: false,
      number_of_transfusion: 0,
      blood_group: 'A+'
    });

    const plan = await WeeklyPlan.create({
      weekStart: toBs('2026-02-02'),
      weekEnd: toBs('2026-02-08'),
      createdBy: (await User.findOne({ email: 'data@example.com' }))!._id
    });
    planId = plan._id.toString();

    const item = await WeeklyPlanItem.create({
      planId: plan._id,
      requestId: new mongoose.Types.ObjectId(),
      patientId: patient._id,
      assignedHospital: "General Hospital",
      assignedDate: toBs('2026-02-03'),
      assignedUnits: 1
    });
    itemId = item._id.toString();

    const record = await TransfusionRecord.create({
      planItemId: item._id,
      patientId: patient._id,
      scheduledDate: item.assignedDate,
      actualDate: toBs('2026-02-03'),
      unitsTransfused: 1,
      outcome: 'completed',
      createdBy: (await User.findOne({ email: 'data@example.com' }))!._id
    });
    recordId = record._id.toString();
  });

  it('should list transfusion records for data entry', async () => {
    const response = await request(app)
      .get('/api/transfusion-records')
      .set('Authorization', `Bearer ${dataEntryToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.records.length).toBe(1);
  });

  it('should filter transfusion records by planId', async () => {
    const response = await request(app)
      .get(`/api/transfusion-records?planId=${planId}`)
      .set('Authorization', `Bearer ${dataEntryToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.records.length).toBe(1);
    expect(response.body.data.records[0]._id).toBe(recordId);
  });

  it('should reject list for non-authorized roles', async () => {
    const response = await request(app)
      .get('/api/transfusion-records')
      .set('Authorization', `Bearer ${analystToken}`);

    expect(response.status).toBe(403);
  });

  it('should delete a transfusion record as admin and reset item status', async () => {
    const response = await request(app)
      .delete(`/api/transfusion-records/${recordId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    const item = await WeeklyPlanItem.findById(itemId);
    expect(item?.status).toBe(WeeklyPlanItemStatus.SCHEDULED);
  });

  it('should return 404 when deleting missing record', async () => {
    const response = await request(app)
      .delete('/api/transfusion-records/64b64c1c9a2c1c1c1c1c1c1c')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
  });
});
