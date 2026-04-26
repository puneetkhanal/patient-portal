import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app.js';
import { User, UserRole } from '../../src/models/User.js';
import { Patient } from '../../src/models/Patient.js';
import { Settings } from '../../src/models/Settings.js';
import { WeeklyRequest } from '../../src/models/WeeklyRequest.js';
import { WeeklyPlan } from '../../src/models/WeeklyPlan.js';
import { WeeklyPlanItem } from '../../src/models/WeeklyPlanItem.js';
import { TransfusionRecord } from '../../src/models/TransfusionRecord.js';
import bcrypt from 'bcryptjs';
import { getZonedWeekday } from '../../src/utils/weekUtils.js';
import { bsToAdDate } from '../../src/utils/bsDate.js';
import { toBs } from '../utils/bsDate.js';

let app: any;
let mongoServer: MongoMemoryServer;
let dataEntryToken: string;
let patientId: string;
let dataEntryUserId: string;

describe('Weekly Request API Integration Tests', () => {
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
      }
    ]);
    const user = await User.findOne({ email: 'data@example.com' });
    dataEntryUserId = user?._id.toString() || '';

    const patient = await Patient.create({
      registered_date: toBs('2024-01-15'),
      registered_no: 'PAT100',
      patient_name: 'Weekly Request Patient',
      diagnosed: false,
      number_of_transfusion: 0,
      blood_group: 'A+'
    });
    patientId = patient._id.toString();

    await Settings.create({});

    const login = async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'data@example.com', password: 'testpassword123' });

      expect(response.status).toBe(200);
      return response.body.token;
    };

    dataEntryToken = await login();
  });

  it('should create a weekly request for a Friday call', async () => {
    const response = await request(app)
      .post('/api/weekly-requests')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({
        patientId,
        callDate: toBs('2026-02-06'),
        requestedUnits: 1,
        requestedHospital: "General Hospital",
        preferredDate: toBs('2026-02-02')
      });

    expect(response.status).toBe(201);
    expect(response.body.data.request.patientId).toBe(patientId);
    expect(response.body.data.warningBackEntry).toBe(false);
  });

  it('should allow back-entry when enabled and set warning flag', async () => {
    const response = await request(app)
      .post('/api/weekly-requests')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({
        patientId,
        callDate: toBs('2026-02-05'),
        requestedUnits: 2,
        requestedHospital: "General Hospital",
        preferredDate: toBs('2026-02-02')
      });

    expect(response.status).toBe(201);
    expect(response.body.data.warningBackEntry).toBe(true);
  });

  it('should reject back-entry when disabled', async () => {
    await Settings.findOneAndUpdate({}, { $set: { allowBackEntry: false } }, { new: true });

    const response = await request(app)
      .post('/api/weekly-requests')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({
        patientId,
        callDate: toBs('2026-02-05'),
        requestedUnits: 1,
        requestedHospital: "General Hospital",
        preferredDate: toBs('2026-02-02')
      });

    expect(response.status).toBe(400);
  });

  it('should prevent duplicate requests for same patient and week', async () => {
    await request(app)
      .post('/api/weekly-requests')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({
        patientId,
        callDate: toBs('2026-02-06'),
        requestedUnits: 1,
        requestedHospital: "General Hospital",
        preferredDate: toBs('2026-02-02')
      });

    const response = await request(app)
      .post('/api/weekly-requests')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({
        patientId,
        callDate: toBs('2026-02-06'),
        requestedUnits: 1,
        requestedHospital: "General Hospital",
        preferredDate: toBs('2026-02-02')
      });

    expect(response.status).toBe(409);
  });

  it('should auto-plan request when weekly plan exists', async () => {
    const weekStart = toBs('2026-02-01');
    const weekEnd = toBs('2026-02-07');

    const plan = await WeeklyPlan.create({
      weekStart,
      weekEnd,
      createdBy: dataEntryUserId
    });

    const response = await request(app)
      .post('/api/weekly-requests')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({
        patientId,
        callDate: toBs('2026-02-06'),
        requestedUnits: 1,
        requestedHospital: "General Hospital",
        preferredDate: toBs('2026-02-02')
      });

    expect(response.status).toBe(201);
    expect(response.body.data.autoPlanned).toBe(true);
    expect(response.body.data.request.status).toBe('planned');

    const planItem = await WeeklyPlanItem.findOne({ planId: plan._id, requestId: response.body.data.request._id });
    expect(planItem).toBeTruthy();
  });

  it('should delete a weekly request', async () => {
    const created = await request(app)
      .post('/api/weekly-requests')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({
        patientId,
        callDate: toBs('2026-02-06'),
        requestedUnits: 1,
        requestedHospital: "General Hospital",
        preferredDate: toBs('2026-02-02')
      });

    expect(created.status).toBe(201);
    const requestId = created.body.data.request._id;

    const response = await request(app)
      .delete(`/api/weekly-requests/${requestId}`)
      .set('Authorization', `Bearer ${dataEntryToken}`);

    expect(response.status).toBe(200);
    const remaining = await WeeklyRequest.findById(requestId);
    expect(remaining).toBeNull();
  });

  it('should delete a planned weekly request without transfusion records', async () => {
    const weekStart = toBs('2026-02-01');
    const weekEnd = toBs('2026-02-07');

    const plan = await WeeklyPlan.create({
      weekStart,
      weekEnd,
      createdBy: dataEntryUserId
    });

    const created = await request(app)
      .post('/api/weekly-requests')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({
        patientId,
        callDate: toBs('2026-02-06'),
        requestedUnits: 1,
        requestedHospital: "General Hospital",
        preferredDate: toBs('2026-02-02')
      });

    expect(created.status).toBe(201);
    const requestId = created.body.data.request._id;

    const planItem = await WeeklyPlanItem.findOne({ planId: plan._id, requestId });
    expect(planItem).toBeTruthy();

    const response = await request(app)
      .delete(`/api/weekly-requests/${requestId}`)
      .set('Authorization', `Bearer ${dataEntryToken}`);

    expect(response.status).toBe(200);
    const remaining = await WeeklyRequest.findById(requestId);
    expect(remaining).toBeNull();
    const remainingItem = await WeeklyPlanItem.findById(planItem?._id);
    expect(remainingItem).toBeNull();
  });

  it('should block deleting planned request with transfusion records', async () => {
    const weekStart = toBs('2026-02-01');
    const weekEnd = toBs('2026-02-07');

    const plan = await WeeklyPlan.create({
      weekStart,
      weekEnd,
      createdBy: dataEntryUserId
    });

    const created = await request(app)
      .post('/api/weekly-requests')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({
        patientId,
        callDate: toBs('2026-02-06'),
        requestedUnits: 1,
        requestedHospital: "General Hospital",
        preferredDate: toBs('2026-02-02')
      });

    const requestId = created.body.data.request._id;
    const planItem = await WeeklyPlanItem.findOne({ planId: plan._id, requestId });
    expect(planItem).toBeTruthy();

    await TransfusionRecord.create({
      planItemId: planItem?._id,
      patientId,
      scheduledDate: toBs('2026-02-02'),
      actualDate: toBs('2026-02-02'),
      unitsTransfused: 1,
      outcome: 'completed',
      createdBy: dataEntryUserId
    });

    const response = await request(app)
      .delete(`/api/weekly-requests/${requestId}`)
      .set('Authorization', `Bearer ${dataEntryToken}`);

    expect(response.status).toBe(400);
  });

  it('should return availability for the week', async () => {
    await Settings.findOneAndUpdate(
      {},
      {
        $set: {
          hospitalList: ["General Hospital", 'Community Hospital'],
          hospitalCapacities: [
            {
              name: "General Hospital",
              slots: {
                Sunday: 2,
                Monday: 3,
                Tuesday: 2,
                Wednesday: 2,
                Thursday: 2,
                Friday: 2,
                Saturday: 2
              }
            }
          ]
        }
      },
      { new: true }
    );

    const weekStart = toBs('2026-02-01');
    const weekEnd = toBs('2026-02-07');

    const plan = await WeeklyPlan.create({
      weekStart,
      weekEnd,
      createdBy: dataEntryUserId
    });

    const monday = toBs('2026-02-03');

    await WeeklyPlanItem.create({
      planId: plan._id,
      requestId: new mongoose.Types.ObjectId(),
      patientId: patientId,
      assignedHospital: "General Hospital",
      assignedDate: monday,
      assignedUnits: 1
    });

    const preferredDate = monday;
    const requestResponse = await request(app)
      .post('/api/weekly-requests')
      .set('Authorization', `Bearer ${dataEntryToken}`)
      .send({
        patientId,
        callDate: toBs('2026-02-06'),
        requestedUnits: 1,
        requestedHospital: "General Hospital",
        preferredDate
      });

    expect(requestResponse.status).toBe(201);

    const response = await request(app)
      .get(`/api/weekly-requests/availability?weekStart=${weekStart}`)
      .set('Authorization', `Bearer ${dataEntryToken}`);

    expect(response.status).toBe(200);
    const hospitals = response.body.data.hospitals || [];
    expect(hospitals.length).toBeGreaterThan(0);
    const availability = hospitals.find((hospital: any) => hospital.name === "General Hospital")
      || hospitals[0];
    expect(availability).toBeDefined();
    expect(availability.plannedByDay).toBeDefined();
    const settings = await Settings.findOne({});
    const timeZone = settings?.weekTimeZone || 'Asia/Kathmandu';
    const expectedDay = getZonedWeekday(bsToAdDate(monday)!, timeZone);
    const expectedCapacity = expectedDay === 'Monday' ? 3 : 2;
    expect(availability.capacityByDay[expectedDay]).toBe(expectedCapacity);
    const requestedByDay = availability.requestedByDay || {};
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].forEach((day) => {
      expect(typeof availability.plannedByDay[day]).toBe('number');
      expect(typeof requestedByDay[day]).toBe('number');
    });
  });
});
