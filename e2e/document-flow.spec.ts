import { test, expect, request } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const adminEmail = 'admin@example.com';
const adminPassword = '123456';

test('patient document upload and reviewer verification flow', async () => {
  test.setTimeout(60_000);

  const api = await request.newContext({ baseURL });

  const adminLogin = await api.post('/api/auth/login', {
    data: { email: adminEmail, password: adminPassword }
  });
  expect(adminLogin.status()).toBe(200);
  const adminToken = (await adminLogin.json()).token;

  const reviewerEmail = `e2e_reviewer_${Date.now()}@example.com`;
  const reviewerPassword = `Temp${Date.now()}`;

  await api.post('/api/users', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      email: reviewerEmail,
      name: 'E2E Reviewer',
      role: 'medical_reviewer',
      tempPassword: reviewerPassword
    }
  });

  const reviewerLogin = await api.post('/api/auth/login', {
    data: { email: reviewerEmail, password: reviewerPassword }
  });
  expect(reviewerLogin.status()).toBe(200);
  const reviewerToken = (await reviewerLogin.json()).token;

  const regNo = `E2E-DOC-${Date.now()}`;
  const createPatient = await api.post('/api/patients', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      registered_date: new Date().toISOString().split('T')[0],
      registered_no: regNo,
      patient_name: 'E2E Document Patient',
      gender: 'Male',
      blood_group: 'A+',
      diagnosed: false
    }
  });
  expect(createPatient.status()).toBe(201);
  const patientId = (await createPatient.json()).data.patient._id;

  const uploadDoc = await api.post(`/api/patients/${patientId}/documents`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    multipart: {
      documentType: 'diagnosis_report',
      issuingAuthority: 'E2E Hospital',
      file: {
        name: 'e2e-report.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 E2E test file')
      }
    }
  });
  expect(uploadDoc.status()).toBe(201);
  const documentId = (await uploadDoc.json()).data.document._id;

  const verifyDoc = await api.patch(`/api/patients/${patientId}/documents/${documentId}/verify`, {
    headers: { Authorization: `Bearer ${reviewerToken}` },
    data: { remarks: 'Verified by E2E' }
  });
  expect(verifyDoc.status()).toBe(200);
  expect((await verifyDoc.json()).data.document.status).toBe('verified');

  const listDocs = await api.get(`/api/patients/${patientId}/documents?status=verified`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  expect(listDocs.status()).toBe(200);
  const docs = (await listDocs.json()).data.documents;
  expect(docs.some((doc: { _id: string; status: string }) => doc._id === documentId && doc.status === 'verified')).toBe(true);
});
