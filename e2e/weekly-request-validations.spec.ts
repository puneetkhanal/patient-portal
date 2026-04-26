import { test, expect, request } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const adminEmail = 'admin@example.com';
const adminPassword = '123456';

async function loginApi(api: ReturnType<typeof request.newContext>) {
  const response = await api.post('/api/auth/login', { data: { email: adminEmail, password: adminPassword } });
  expect(response.status()).toBe(200);
  const body = await response.json();
  return body.token as string;
}

test.describe.serial('weekly request validations', () => {
  test('back-entry is blocked when disabled', async () => {
    const api = await request.newContext({ baseURL });
    const token = await loginApi(api);

    const settingsRes = await api.get('/api/settings', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const settings = (await settingsRes.json()).data.settings;

    await api.put('/api/settings', {
      headers: { Authorization: `Bearer ${token}` },
      data: { ...settings, allowBackEntry: false }
    });

    const patientRes = await api.post('/api/patients', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        registered_date: '2026-02-04',
        registered_no: `VAL-${Date.now()}`,
        patient_name: 'Validation Patient',
        gender: 'Male',
        blood_group: 'A+',
        diagnosed: true
      }
    });
    expect(patientRes.status()).toBe(201);
    const patient = (await patientRes.json()).data.patient;

    const response = await api.post('/api/weekly-requests', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        patientId: patient._id,
        callDate: '2026-02-04',
        requestedUnits: 1,
        requestedHospital: "General Hospital",
        preferredDate: '2026-02-04'
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.message).toMatch(/back-entry not allowed/i);
  });

  test('back-entry allowed when enabled and warning is returned', async () => {
    const api = await request.newContext({ baseURL });
    const token = await loginApi(api);

    const settingsRes = await api.get('/api/settings', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const settings = (await settingsRes.json()).data.settings;

    await api.put('/api/settings', {
      headers: { Authorization: `Bearer ${token}` },
      data: { ...settings, allowBackEntry: true }
    });

    const patientRes = await api.post('/api/patients', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        registered_date: '2026-02-04',
        registered_no: `VAL-${Date.now()}`,
        patient_name: 'Back Entry Patient',
        gender: 'Female',
        blood_group: 'B+',
        diagnosed: true
      }
    });
    expect(patientRes.status()).toBe(201);
    const patient = (await patientRes.json()).data.patient;

    const response = await api.post('/api/weekly-requests', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        patientId: patient._id,
        callDate: '2026-02-04',
        requestedUnits: 1,
        requestedHospital: "General Hospital",
        preferredDate: '2026-02-04'
      }
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.data.warningBackEntry).toBe(true);
  });

  test('preferred date must be within the selected week', async () => {
    const api = await request.newContext({ baseURL });
    const token = await loginApi(api);

    const patientRes = await api.post('/api/patients', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        registered_date: '2026-02-04',
        registered_no: `VAL-${Date.now()}`,
        patient_name: 'Preferred Date Patient',
        gender: 'Male',
        blood_group: 'O+',
        diagnosed: true
      }
    });
    expect(patientRes.status()).toBe(201);
    const patient = (await patientRes.json()).data.patient;

    const response = await api.post('/api/weekly-requests', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        patientId: patient._id,
        callDate: '2026-02-04',
        requestedUnits: 1,
        requestedHospital: "General Hospital",
        preferredDate: '2026-02-20'
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.message).toMatch(/preferredDate must be within the selected week/i);
  });

  test('one request per patient per week is enforced', async () => {
    const api = await request.newContext({ baseURL });
    const token = await loginApi(api);

    const patientRes = await api.post('/api/patients', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        registered_date: '2026-02-04',
        registered_no: `VAL-${Date.now()}`,
        patient_name: 'One Per Week Patient',
        gender: 'Female',
        blood_group: 'AB+',
        diagnosed: true
      }
    });
    expect(patientRes.status()).toBe(201);
    const patient = (await patientRes.json()).data.patient;

    const first = await api.post('/api/weekly-requests', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        patientId: patient._id,
        callDate: '2026-02-04',
        requestedUnits: 1,
        requestedHospital: "General Hospital",
        preferredDate: '2026-02-04'
      }
    });
    expect(first.status()).toBe(201);

    const second = await api.post('/api/weekly-requests', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        patientId: patient._id,
        callDate: '2026-02-04',
        requestedUnits: 1,
        requestedHospital: "General Hospital",
        preferredDate: '2026-02-04'
      }
    });
    expect(second.status()).toBe(409);
    const data = await second.json();
    expect(data.message).toMatch(/request already exists/i);
  });
});
