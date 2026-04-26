import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app.js';
import { User, UserRole } from '../../src/models/User.js';
import { Patient } from '../../src/models/Patient.js';
import { WeeklyRequest } from '../../src/models/WeeklyRequest.js';
import { WeeklyPlan } from '../../src/models/WeeklyPlan.js';
import { WeeklyPlanItem } from '../../src/models/WeeklyPlanItem.js';
import { TransfusionRecord } from '../../src/models/TransfusionRecord.js';
import bcrypt from 'bcryptjs';
import { toBs } from '../utils/bsDate.js';

let app: any;
let mongoServer: MongoMemoryServer;
let adminToken: string;

describe('Reports API Integration Tests', () => {
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
    await WeeklyRequest.deleteMany({});
    await WeeklyPlan.deleteMany({});
    await WeeklyPlanItem.deleteMany({});
    await TransfusionRecord.deleteMany({});

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
      }
    ]);

    const login = async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@example.com', password: 'testpassword123' });

      expect(response.status).toBe(200);
      return response.body.token;
    };

    adminToken = await login();

    const patientA = await Patient.create({
      registered_date: toBs('2024-01-01'),
      registered_no: 'PAT300',
      patient_name: 'Patient A',
      diagnosed: true,
      number_of_transfusion: 0,
      blood_group: 'A+'
    });

    const patientB = await Patient.create({
      registered_date: toBs('2024-01-02'),
      registered_no: 'PAT301',
      patient_name: 'Patient B',
      diagnosed: true,
      number_of_transfusion: 0,
      blood_group: 'B+'
    });

    const weekStart = toBs('2026-02-02');
    const weekEnd = toBs('2026-02-08');

    const plan = await WeeklyPlan.create({
      weekStart,
      weekEnd,
      createdBy: (await User.findOne({}))!._id
    });

    const requestA = await WeeklyRequest.create({
      patientId: patientA._id,
      weekStart,
      weekEnd,
      callDate: toBs('2026-02-06'),
      requestedUnits: 1,
      requestedHospital: "General Hospital",
      createdBy: (await User.findOne({}))!._id
    });

    const requestB = await WeeklyRequest.create({
      patientId: patientB._id,
      weekStart,
      weekEnd,
      callDate: toBs('2026-02-06'),
      requestedUnits: 2,
      requestedHospital: 'Community Hospital',
      createdBy: (await User.findOne({}))!._id
    });

    const itemA = await WeeklyPlanItem.create({
      planId: plan._id,
      requestId: requestA._id,
      patientId: patientA._id,
      assignedHospital: "General Hospital",
      assignedDate: toBs('2026-02-03'),
      assignedUnits: 1
    });

    const itemB = await WeeklyPlanItem.create({
      planId: plan._id,
      requestId: requestB._id,
      patientId: patientB._id,
      assignedHospital: 'Community Hospital',
      assignedDate: toBs('2026-02-04'),
      assignedUnits: 2
    });

    await TransfusionRecord.create({
      planItemId: itemA._id,
      patientId: patientA._id,
      scheduledDate: itemA.assignedDate,
      actualDate: toBs('2026-02-03'),
      unitsTransfused: 1,
      outcome: 'completed',
      createdBy: (await User.findOne({}))!._id
    });

    await TransfusionRecord.create({
      planItemId: itemA._id,
      patientId: patientA._id,
      scheduledDate: itemA.assignedDate,
      actualDate: toBs('2026-02-10'),
      unitsTransfused: 1,
      outcome: 'completed',
      createdBy: (await User.findOne({}))!._id
    });

    await TransfusionRecord.create({
      planItemId: itemB._id,
      patientId: patientB._id,
      scheduledDate: itemB.assignedDate,
      actualDate: toBs('2026-02-04'),
      unitsTransfused: 0,
      outcome: 'completed',
      createdBy: (await User.findOne({}))!._id
    });
  });

  it('should return transfusion frequency report', async () => {
    const response = await request(app)
      .get('/api/reports/transfusion-frequency')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.results.length).toBe(2);
  });

  it('should return shortage report', async () => {
    const response = await request(app)
      .get('/api/reports/shortage')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.results.length).toBe(1);
    expect(response.body.data.results[0].shortageUnits).toBe(1);
  });

  it('should return hospital load report', async () => {
    const response = await request(app)
      .get('/api/reports/hospital-load')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.hospitalTotals.length).toBe(2);
  });
});
