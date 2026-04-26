import { test, expect, request } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const adminEmail = 'admin@example.com';
const adminPassword = '123456';

async function loginApi(api: ReturnType<typeof request.newContext>, email: string, password: string) {
  const response = await api.post('/api/auth/login', { data: { email, password } });
  expect(response.status()).toBe(200);
  const body = await response.json();
  return body.token as string;
}

test('patient list search, filter, sort, and empty result (API)', async () => {
  const api = await request.newContext({ baseURL });
  const adminToken = await loginApi(api, adminEmail, adminPassword);

  const suffix = Date.now().toString();
  const patients = [
    {
      registered_no: `S-${suffix}-001`,
      patient_name: `Alice ${suffix}`,
      gender: 'Female',
      blood_group: 'A+',
      diagnosed: true
    },
    {
      registered_no: `S-${suffix}-002`,
      patient_name: `Bob ${suffix}`,
      gender: 'Male',
      blood_group: 'B+',
      diagnosed: false
    },
    {
      registered_no: `S-${suffix}-003`,
      patient_name: `Charlie ${suffix}`,
      gender: 'Male',
      blood_group: 'O+',
      diagnosed: true
    }
  ];

  for (const patient of patients) {
    const res = await api.post('/api/patients', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        registered_date: new Date().toISOString().split('T')[0],
        ...patient
      }
    });
    expect(res.status()).toBe(201);
  }

  const search = await api.get(`/api/patients?search=${encodeURIComponent(`Alice ${suffix}`)}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  expect(search.status()).toBe(200);
  const searchPatients = (await search.json()).data.patients;
  expect(searchPatients.length).toBe(1);
  expect(searchPatients[0].registered_no).toBe(`S-${suffix}-001`);

  const filter = await api.get('/api/patients?gender=Male&diagnosed=true', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  expect(filter.status()).toBe(200);
  const filterPatients = (await filter.json()).data.patients;
  const filterRegs = filterPatients.map((p: any) => p.registered_no);
  expect(filterRegs).toContain(`S-${suffix}-003`);
  expect(filterRegs).not.toContain(`S-${suffix}-002`);

  const sort = await api.get(
    `/api/patients?search=${encodeURIComponent(`S-${suffix}`)}&sortBy=registered_no&sortOrder=asc&limit=50`,
    {
      headers: { Authorization: `Bearer ${adminToken}` }
    }
  );
  expect(sort.status()).toBe(200);
  const sorted = (await sort.json()).data.patients;
  const sortedRegs = sorted.map((p: any) => p.registered_no);
  expect(sortedRegs).toEqual([
    `S-${suffix}-001`,
    `S-${suffix}-002`,
    `S-${suffix}-003`
  ]);

  const empty = await api.get('/api/patients?search=NO_MATCH_12345', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  expect(empty.status()).toBe(200);
  const emptyPatients = (await empty.json()).data.patients;
  expect(emptyPatients.length).toBe(0);
});
