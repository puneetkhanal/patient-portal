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

test.describe('Error handling (API level)', () => {
  test('unauthenticated patient list is rejected with 401', async () => {
    const api = await request.newContext({ baseURL });
    const response = await api.get('/api/patients');
    expect(response.status()).toBe(401);
  });

  test('invalid document upload is rejected with 400', async () => {
    const api = await request.newContext({ baseURL });
    const adminToken = await loginApi(api, adminEmail, adminPassword);

    const regNo = `E2E-ERR-${Date.now()}`;
    const createPatient = await api.post('/api/patients', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        registered_date: new Date().toISOString().split('T')[0],
        registered_no: regNo,
        patient_name: 'E2E Error Patient',
        gender: 'Male',
        blood_group: 'O+',
        diagnosed: false
      }
    });
    expect(createPatient.status()).toBe(201);
    const patientId = (await createPatient.json()).data.patient._id;

    const upload = await api.post(`/api/patients/${patientId}/documents`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      multipart: {
        documentType: 'diagnosis_report',
        issuingAuthority: 'E2E',
        file: {
          name: 'invalid.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from('not allowed')
        }
      }
    });
    expect(upload.status()).toBe(400);
    const body = await upload.json();
    expect(body.message || body.error).toMatch(/invalid file type|only images/i);
  });

  test('reject document requires remarks (400)', async () => {
    const api = await request.newContext({ baseURL });
    const adminToken = await loginApi(api, adminEmail, adminPassword);

    const regNo = `E2E-ERR-REJ-${Date.now()}`;
    const createPatient = await api.post('/api/patients', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        registered_date: new Date().toISOString().split('T')[0],
        registered_no: regNo,
        patient_name: 'E2E Reject Patient',
        gender: 'Female',
        blood_group: 'A+',
        diagnosed: false
      }
    });
    expect(createPatient.status()).toBe(201);
    const patientId = (await createPatient.json()).data.patient._id;

    const upload = await api.post(`/api/patients/${patientId}/documents`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      multipart: {
        documentType: 'diagnosis_report',
        issuingAuthority: 'E2E',
        file: {
          name: 'report.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('%PDF-1.4 E2E')
        }
      }
    });
    expect(upload.status()).toBe(201);
    const documentId = (await upload.json()).data.document._id;

    const reject = await api.patch(`/api/patients/${patientId}/documents/${documentId}/reject`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { remarks: '' }
    });
    expect(reject.status()).toBe(400);
    const body = await reject.json();
    expect(body.message || body.error).toMatch(/remarks/i);
  });

  test('upload exceeding size limit is rejected with 400', async () => {
    const api = await request.newContext({ baseURL });
    const adminToken = await loginApi(api, adminEmail, adminPassword);

    const regNo = `E2E-ERR-SIZE-${Date.now()}`;
    const createPatient = await api.post('/api/patients', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        registered_date: new Date().toISOString().split('T')[0],
        registered_no: regNo,
        patient_name: 'E2E Size Patient',
        gender: 'Male',
        blood_group: 'B+',
        diagnosed: false
      }
    });
    expect(createPatient.status()).toBe(201);
    const patientId = (await createPatient.json()).data.patient._id;

    const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1024, 0);
    const upload = await api.post(`/api/patients/${patientId}/documents`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      multipart: {
        documentType: 'diagnosis_report',
        issuingAuthority: 'E2E',
        file: {
          name: 'too-large.pdf',
          mimeType: 'application/pdf',
          buffer: largeBuffer
        }
      }
    });
    expect(upload.status()).toBe(400);
  });
});
