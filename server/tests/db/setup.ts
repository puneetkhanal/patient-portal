import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  User,
  Patient,
  Settings,
  WeeklyRequest,
  WeeklyPlan,
  WeeklyPlanItem,
  TransfusionRecord
} from '../../src/models/index.js';
import { Document } from '../../src/models/Document.js';
import bcrypt from 'bcryptjs';
import { toBs } from '../utils/bsDate.js';

let mongoServer: MongoMemoryServer;

/**
 * Connect to in-memory MongoDB for testing
 */
export async function connectTestDatabase(): Promise<void> {
  // Start in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const mongoUrl = mongoServer.getUri();

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUrl);
  }
}

/**
 * Disconnect from test database
 */
export async function disconnectTestDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
}

/**
 * Clears all data from the test database (useful between tests)
 */
export async function clearTestDatabase(): Promise<void> {
  await User.deleteMany({});
  await Patient.deleteMany({});
  await Document.deleteMany({});
  await Settings.deleteMany({});
  await WeeklyRequest.deleteMany({});
  await WeeklyPlan.deleteMany({});
  await WeeklyPlanItem.deleteMany({});
  await TransfusionRecord.deleteMany({});
}

/**
 * Seeds the test database with sample data
 */
export async function seedTestDatabase(): Promise<void> {
  // Create test users
  const hashedPassword1 = await bcrypt.hash('password123', 10);
  const hashedPassword2 = await bcrypt.hash('password456', 10);

  await User.create([
    {
      email: 'test@example.com',
      name: 'Test User',
      password_hash: hashedPassword1,
    },
    {
      email: 'john@example.com',
      name: 'John Doe',
      password_hash: hashedPassword2,
    },
  ]);

  // Create test patients
  await Patient.create([
    {
      registered_date: toBs('2024-01-15'),
      registered_no: 'PAT001',
      patient_name: 'Sample Patient',
      diagnosed: true,
      number_of_transfusion: 5,
    },
    {
      registered_date: toBs('2024-02-20'),
      registered_no: 'PAT002',
      patient_name: 'Example Patient',
      diagnosed: false,
      number_of_transfusion: 0,
    },
  ]);
}
