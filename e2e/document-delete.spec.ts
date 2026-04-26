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

test('super admin can delete a document and it is removed from patient documents', async () => {
  const api = await request.newContext({ baseURL });
  const adminToken = await loginApi(api, adminEmail, adminPassword);

  const regNo = `E2E-DEL-DOC-${Date.now()}`;
  const createPatient = await api.post('/api/patients', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      registered_date: new Date().toISOString().split('T')[0],
      registered_no: regNo,
      patient_name: 'E2E Doc Delete Patient',
      gender: 'Female',
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
        name: 'to-delete.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 delete')
      }
    }
  });
  expect(upload.status()).toBe(201);
  const documentId = (await upload.json()).data.document._id;

  const del = await api.delete(`/api/patients/${patientId}/documents/${documentId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  expect(del.status()).toBe(200);

  const list = await api.get(`/api/patients/${patientId}/documents`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  expect(list.status()).toBe(200);
  const docs = (await list.json()).data.documents || [];
  expect(docs.length).toBe(0);

  const download = await api.get(`/api/patients/${patientId}/documents/${documentId}/download`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  expect(download.status()).toBe(404);
});
