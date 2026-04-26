import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app.js';
import { User, UserRole } from '../../src/models/User.js';
import { Patient } from '../../src/models/Patient.js';
import { Settings } from '../../src/models/Settings.js';
import { WeeklyRequest } from '../../src/models/WeeklyRequest.js';
import { WeeklyRequestStatus } from '../../src/models/WeeklyRequest.js';
import { WeeklyPlan } from '../../src/models/WeeklyPlan.js';
import { WeeklyPlanItem } from '../../src/models/WeeklyPlanItem.js';
import { getWeekRange } from '../../src/utils/weekUtils.js';
import { bsToAdDate } from '../../src/utils/bsDate.js';
import { toBs } from '../utils/bsDate.js';
import bcrypt from 'bcryptjs';

let app: any;
let mongoServer: MongoMemoryServer;
let dataEntryToken: string;
let patientId: string;
let patientId2: string;
let weekStart: string;
let weekEnd: string;
let weekSeedDate: string;

describe('Weekly Plan API Integration Tests', () => {
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
    await Settings.deleteMany({});
    await WeeklyRequest.deleteMany({});
    await WeeklyPlan.deleteMany({});
    await WeeklyPlanItem.deleteMany({});

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
      }
    ]);

    const patient = await Patient.create({
      registered_date: toBs('2024-01-15'),
      registered_no: 'PAT200',
      patient_name: 'Plan Patient',
      diagnosed: false,
      number_of_transfusion: 0,
      blood_group: 'A+'
    });
    patientId = patient._id.toString();

    const patient2 = await Patient.create({
      registered_date: toBs('2024-01-16'),
      registered_no: 'PAT201',
      patient_name: 'Plan Patient Two',
      diagnosed: false,
      number_of_transfusion: 0,
      blood_group: 'B+'
    });
    patientId2 = patient2._id.toString();

    const settings = await Settings.create({
      emailRecipients: [
        { name: 'Blood Bank', email: 'bloodbank@example.com', active: true }
      ]
    });
    weekSeedDate = toBs('2026-02-02');
    const seedAd = bsToAdDate(weekSeedDate) || new Date('2026-02-02T12:00:00.000Z');
    const range = getWeekRange(seedAd, settings.weekStartDay, settings.weekTimeZone);
    weekStart = toBs(range.weekStart.toISOString().slice(0, 10));
    weekEnd = toBs(range.weekEnd.toISOString().slice(0, 10));

    const creatorId = (await User.findOne({}))!._id;
    await WeeklyRequest.create([
      {
        patientId,
        weekStart,
        weekEnd,
        callDate: toBs('2026-02-06'),
        requestedUnits: 1,
        requestedHospital: "General Hospital",
        createdBy: creatorId
      },
      {
        patientId: patientId2,
        weekStart,
        weekEnd,
        callDate: toBs('2026-02-06'),
        requestedUnits: 2,
        requestedHospital: 'Community Hospital',
        createdBy: creatorId
      }
    ]);

    const login = async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'data@example.com', password: 'testpassword123' });

      expect(response.status).toBe(200);
      return response.body.token;
    };

    dataEntryToken = await login();
  });

  it('should create a weekly plan and plan items', async () => {
    const response = await request(app)
      .post('/api/weekly-plans')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ weekStart });

    expect(response.status).toBe(201);
    expect(response.body.data.plan.weekStart).toBeTypeOf('string');
    expect(response.body.data.plan.weekStart.length).toBe(10);
    expect(response.body.data.items.length).toBe(2);

    const updated = await WeeklyRequest.findOne({ patientId });
    expect(updated?.status).toBe(WeeklyRequestStatus.PLANNED);
  });

  it('should return plan with items', async () => {
    const create = await request(app)
      .post('/api/weekly-plans')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ weekStart });

    expect(create.status).toBe(201);
    const planId = create.body.data.plan._id;

    const response = await request(app)
      .get(`/api/weekly-plans/${planId}`)
      .set('Authorization', `Bearer ${dataEntryToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBe(2);
  });

  it('should list weekly plans', async () => {
    const create = await request(app)
      .post('/api/weekly-plans')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ weekStart });

    expect(create.status).toBe(201);

    const response = await request(app)
      .get('/api/weekly-plans')
      .set('Authorization', `Bearer ${dataEntryToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.plans.length).toBeGreaterThan(0);
  });

  it('should delete a weekly plan and restore requests', async () => {
    const create = await request(app)
      .post('/api/weekly-plans')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ weekStart });

    expect(create.status).toBe(201);
    const planId = create.body.data.plan._id;

    const adminPassword = await bcrypt.hash('admin123', 10);
    await mongoose.connection.db.collection('users').insertOne({
      email: 'admin@example.com',
      name: 'Admin',
      password_hash: adminPassword,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      created_at: new Date(),
      updated_at: new Date()
    });

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'admin123' });

    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.token;

    const response = await request(app)
      .delete(`/api/weekly-plans/${planId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    const plan = await WeeklyPlan.findById(planId);
    expect(plan).toBeNull();

    const requests = await WeeklyRequest.find({ weekStart });
    expect(requests.length).toBe(2);
    expect(requests[0].status).toBe(WeeklyRequestStatus.PLANNED);
  });

  it('should update a plan item', async () => {
    const create = await request(app)
      .post('/api/weekly-plans')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ weekStart });

    expect(create.status).toBe(201);
    const itemId = create.body.data.items[0]._id;

    const response = await request(app)
      .patch(`/api/plan-items/${itemId}`)
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ assignedHospital: 'Community Hospital' });

    expect(response.status).toBe(200);
    expect(response.body.data.item.assignedHospital).toBe('Community Hospital');
  });

  it('should return weekly summary totals', async () => {
    const create = await request(app)
      .post('/api/weekly-plans')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ weekStart });

    expect(create.status).toBe(201);
    const planId = create.body.data.plan._id;

    const response = await request(app)
      .get(`/api/weekly-plans/${planId}/summary`)
      .set('Authorization', `Bearer ${dataEntryToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.summary.totalUnits).toBe(3);
    expect(response.body.data.summary.byBloodGroup['A+']).toBe(1);
    expect(response.body.data.summary.byBloodGroup['B+']).toBe(2);
  });

  it('should send weekly summary email and mark plan as sent', async () => {
    const create = await request(app)
      .post('/api/weekly-plans')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ weekStart });

    expect(create.status).toBe(201);
    const planId = create.body.data.plan._id;

    const response = await request(app)
      .post(`/api/weekly-plans/${planId}/send-email`)
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({});

    expect(response.status).toBe(200);
    expect(response.body.data.sentAt).toBeTruthy();
  });

  it('should confirm transfusion outcome and create record', async () => {
    const create = await request(app)
      .post('/api/weekly-plans')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ weekStart });

    expect(create.status).toBe(201);
    const planId = create.body.data.plan._id;
    const item = await WeeklyPlanItem.findOne({ planId });
    expect(item).toBeTruthy();
    const itemId = item?._id.toString() as string;

    const response = await request(app)
      .patch(`/api/plan-items/${itemId}/confirm`)
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({
        actualDate: toBs('2026-02-03'),
        unitsTransfused: 1,
        outcome: 'completed',
        notes: 'No reactions'
      });

    expect(response.status).toBe(200);
    expect(response.body.data.item.status).toBe('completed');
    expect(response.body.data.record.outcome).toBe('completed');
  });

  it('should reject confirm when required fields are missing', async () => {
    const create = await request(app)
      .post('/api/weekly-plans')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ weekStart });

    expect(create.status).toBe(201);
    const planId = create.body.data.plan._id;
    const item = await WeeklyPlanItem.findOne({ planId });
    expect(item).toBeTruthy();

    const response = await request(app)
      .patch(`/api/plan-items/${item?._id}/confirm`)
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({
        unitsTransfused: 1,
        outcome: 'completed'
      });

    expect(response.status).toBe(400);
  });

  it('should reject confirm with invalid outcome', async () => {
    const create = await request(app)
      .post('/api/weekly-plans')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ weekStart });

    expect(create.status).toBe(201);
    const planId = create.body.data.plan._id;
    const item = await WeeklyPlanItem.findOne({ planId });
    expect(item).toBeTruthy();

    const response = await request(app)
      .patch(`/api/plan-items/${item?._id}/confirm`)
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({
        actualDate: toBs('2026-02-03'),
        unitsTransfused: 1,
        outcome: 'invalid'
      });

    expect(response.status).toBe(400);
  });

  it('should return 404 for missing plan item update', async () => {
    const response = await request(app)
      .patch('/api/plan-items/64b64c1c9a2c1c1c1c1c1c1c')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ assignedHospital: 'Community Hospital' });

    expect(response.status).toBe(404);
  });

  it('should reject plan item update with invalid units', async () => {
    const create = await request(app)
      .post('/api/weekly-plans')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ weekStart });

    expect(create.status).toBe(201);
    const planId = create.body.data.plan._id;
    const item = await WeeklyPlanItem.findOne({ planId });
    expect(item).toBeTruthy();

    const response = await request(app)
      .patch(`/api/plan-items/${item?._id}`)
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ assignedUnits: 3 });

    expect(response.status).toBe(400);
  });

  it('should reject plan item update with invalid date', async () => {
    const create = await request(app)
      .post('/api/weekly-plans')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ weekStart });

    expect(create.status).toBe(201);
    const planId = create.body.data.plan._id;
    const item = await WeeklyPlanItem.findOne({ planId });
    expect(item).toBeTruthy();

    const response = await request(app)
      .patch(`/api/plan-items/${item?._id}`)
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ assignedDate: 'invalid-date' });

    expect(response.status).toBe(400);
  });

  it('should delete transfusion record and allow plan deletion', async () => {
    const create = await request(app)
      .post('/api/weekly-plans')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({ weekStart });

    expect(create.status).toBe(201);
    const planId = create.body.data.plan._id;
    const item = await WeeklyPlanItem.findOne({ planId });
    expect(item).toBeTruthy();
    const itemId = item?._id.toString() as string;

    const confirm = await request(app)
      .patch(`/api/plan-items/${itemId}/confirm`)
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({
        actualDate: toBs('2026-02-03'),
        unitsTransfused: 1,
        outcome: 'completed'
      });

    expect(confirm.status).toBe(200);
    const recordId = confirm.body.data.record._id;

    const adminPassword = await bcrypt.hash('admin123', 10);
    await mongoose.connection.db.collection('users').insertOne({
      email: 'admin2@example.com',
      name: 'Admin2',
      password_hash: adminPassword,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      created_at: new Date(),
      updated_at: new Date()
    });

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin2@example.com', password: 'admin123' });

    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.token;

    const deleteRecord = await request(app)
      .delete(`/api/transfusion-records/${recordId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deleteRecord.status).toBe(200);

    const deletePlan = await request(app)
      .delete(`/api/weekly-plans/${planId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(deletePlan.status).toBe(200);
  });
});
