// tests/models/TransfusionModels.test.ts
import {
  connectTestDatabase,
  disconnectTestDatabase,
  clearTestDatabase,
  seedTestDatabase
} from '../db/setup.js';
import { User } from '../../src/models/User.js';
import { Patient } from '../../src/models/Patient.js';
import { WeeklyRequest, WeeklyRequestStatus } from '../../src/models/WeeklyRequest.js';
import { WeeklyPlan, WeeklyPlanStatus } from '../../src/models/WeeklyPlan.js';
import { WeeklyPlanItem, WeeklyPlanItemStatus } from '../../src/models/WeeklyPlanItem.js';
import { TransfusionRecord, TransfusionOutcome } from '../../src/models/TransfusionRecord.js';
import { toBs } from '../utils/bsDate.js';

describe('Transfusion Models', () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    await seedTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it('should create weekly request, plan, plan item, and transfusion record', async () => {
    const user = await User.findOne({});
    const patient = await Patient.findOne({});

    expect(user).toBeTruthy();
    expect(patient).toBeTruthy();

    const weekStart = toBs('2026-02-02');
    const weekEnd = toBs('2026-02-08');

    const request = await WeeklyRequest.create({
      patientId: patient!._id,
      weekStart,
      weekEnd,
      callDate: toBs('2026-02-06'),
      requestedUnits: 1,
      requestedHospital: 'General Hospital',
      createdBy: user!._id
    });

    expect(request.status).toBe(WeeklyRequestStatus.PENDING);

    const plan = await WeeklyPlan.create({
      weekStart,
      weekEnd,
      createdBy: user!._id
    });

    expect(plan.status).toBe(WeeklyPlanStatus.DRAFT);

    const planItem = await WeeklyPlanItem.create({
      planId: plan._id,
      requestId: request._id,
      patientId: patient!._id,
      assignedHospital: 'General Hospital',
      assignedDate: toBs('2026-02-03'),
      assignedUnits: 1
    });

    expect(planItem.status).toBe(WeeklyPlanItemStatus.SCHEDULED);

    const record = await TransfusionRecord.create({
      planItemId: planItem._id,
      patientId: patient!._id,
      scheduledDate: planItem.assignedDate,
      actualDate: planItem.assignedDate,
      unitsTransfused: 1,
      outcome: TransfusionOutcome.COMPLETED,
      createdBy: user!._id
    });

    expect(record.outcome).toBe(TransfusionOutcome.COMPLETED);
  });
});
