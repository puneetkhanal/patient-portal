// tests/models/Settings.test.ts
import {
  connectTestDatabase,
  disconnectTestDatabase,
  clearTestDatabase
} from '../db/setup.js';
import { Settings } from '../../src/models/Settings.js';

describe('Settings Model', () => {
  beforeAll(async () => {
    await connectTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await disconnectTestDatabase();
  });

  it('should create settings with defaults', async () => {
    const settings = await Settings.create({});

    expect(settings.weekStartDay).toBe('Sunday');
    expect(settings.weekTimeZone).toBe('Asia/Kathmandu');
    expect(settings.calendarMode).toBe('BS');
    expect(settings.allowBackEntry).toBe(true);
    expect(settings.backEntryWarningDays).toBe(7);
    expect(settings.hospitalList).toEqual(['General Hospital', 'Community Hospital']);
    expect(settings.hospitalCapacities).toEqual([]);
    expect(settings.bloodGroups).toEqual(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']);
    expect(settings.emailRecipients).toEqual([]);
  });
});
