import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app.js';
import { User, UserRole } from '../../src/models/User.js';
import { Patient } from '../../src/models/Patient.js';
import { Document } from '../../src/models/Document.js';
import bcrypt from 'bcryptjs';
import { toBs } from '../utils/bsDate.js';

let app: any;
let mongoServer: MongoMemoryServer;
let authToken: string;
let adminToken: string;
let reviewerToken: string;
let testPatient: any;

/**
 * Comprehensive Integration Tests for REST API endpoints
 * Tests all patient and document operations with authentication
 */
describe('API Integration Tests', () => {
  beforeAll(async () => {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUrl = mongoServer.getUri();

    // Connect to test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUrl);
    }

    // Create test app
    app = createApp();

    // Initialize GridFS
    const { DocumentService } = await import('../../src/services/DocumentService.js');
    DocumentService.initializeGridFS();

    console.log('✅ Test database and app initialized');
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log('✅ Test database cleaned up');
  }, 30000);

  beforeEach(async () => {
    // Clear all data before each test
    await User.deleteMany({});
    await Patient.deleteMany({});
    await Document.deleteMany({});

    // Create test users (avoid double hashing by inserting directly)
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    const users = [
      {
        email: 'test@example.com',
        name: 'Test User',
        password_hash: hashedPassword,
        role: UserRole.DATA_ENTRY
      },
      {
        email: 'admin@example.com',
        name: 'Admin User',
        password_hash: hashedPassword,
        role: UserRole.SUPER_ADMIN
      },
      {
        email: 'reviewer@example.com',
        name: 'Medical Reviewer',
        password_hash: hashedPassword,
        role: UserRole.MEDICAL_REVIEWER
      }
    ];

    await mongoose.connection.db.collection('users').insertMany(
      users.map((user) => ({
        ...user,
        isActive: true,
        created_at: new Date(),
        updated_at: new Date()
      }))
    );

    const login = async (email: string) => {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .set('User-Agent', 'Test-Agent/1.0')
        .send({
          email,
          password: 'testpassword123'
        });

      expect(loginResponse.status).toBe(200);
      return loginResponse.body.token;
    };

    authToken = await login('test@example.com');
    adminToken = await login('admin@example.com');
    reviewerToken = await login('reviewer@example.com');

    // Create test patient
    testPatient = await Patient.create({
      registered_date: toBs('2024-01-15'),
      registered_no: 'PAT001',
      patient_name: 'Sample Patient',
      diagnosed: true,
      number_of_transfusion: 5,
      isActive: true
    });
  });

  describe('Authentication', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should reject login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should handle admin login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin',
          password: 'testpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.user.role).toBe('super_admin');
    });

    it('should register new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          name: 'New User',
          password: 'newpassword123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('newuser@example.com');
      expect(response.body.user.role).toBe('data_entry');
    });

    it('should reject registration with existing email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com', // Already exists
          name: 'Duplicate User',
          password: 'password123'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    it('should reject registration with short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'shortpass@example.com',
          name: 'Short Pass',
          password: '123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least 6 characters');
    });

    it('should reject login when email or password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return current user for valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should reject /me without authentication', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authentication required');
    });

    it('should reject /me with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid');
    });
  });

  describe('Patient CRUD Operations', () => {
    it('should get all patients with authentication', async () => {
      const response = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', 'Test-Agent/1.0');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('patients');
      expect(Array.isArray(response.body.data.patients)).toBe(true);
      expect(response.body.data.patients.length).toBeGreaterThan(0);
    });

    it('should reject patient list without authentication', async () => {
      const response = await request(app)
        .get('/api/patients');

      expect(response.status).toBe(401);
    });

    it('should get single patient by ID', async () => {
      const response = await request(app)
        .get(`/api/patients/${testPatient._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.patient.registered_no).toBe('PAT001');
      expect(response.body.data.patient.patient_name).toBe('Sample Patient');
    });

    it('should return 404 for non-existent patient', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/patients/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should create new patient', async () => {
      const newPatientData = {
        registered_date: '2024-02-20',
        registered_no: 'PAT002',
        patient_name: 'Example Patient',
        diagnosed: false,
        number_of_transfusion: 0,
        gender: 'Female',
        blood_group: 'A+',
        dob: '1990-05-15'
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', 'Test-Agent/1.0')
        .send(newPatientData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.patient.registered_no).toBe('PAT002');
      expect(response.body.data.patient.patient_name).toBe('Example Patient');
    });

    it('should reject patient creation with duplicate registered_no', async () => {
      const duplicatePatientData = {
        registered_date: '2024-02-20',
        registered_no: 'PAT001', // Already exists
        patient_name: 'Duplicate Patient',
        diagnosed: false,
        number_of_transfusion: 0
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(duplicatePatientData);

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('already exists');
    });

    it('should reject patient creation with missing required fields', async () => {
      const invalidPatientData = {
        registered_date: '2024-02-20',
        // Missing registered_no and patient_name
        diagnosed: false
      };

      const response = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidPatientData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('required');
    });

    it('should update existing patient', async () => {
      const updateData = {
        patient_name: 'Sample Patient Updated',
        diagnosed: false,
        number_of_transfusion: 10
      };

      const response = await request(app)
        .put(`/api/patients/${testPatient._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('User-Agent', 'Test-Agent/1.0')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.patient.patient_name).toBe('Sample Patient Updated');
      expect(response.body.data.patient.diagnosed).toBe(false);
    });

    it('should reject update with duplicate registered_no', async () => {
      await Patient.create({
        registered_date: toBs('2024-02-20'),
        registered_no: 'PAT002',
        patient_name: 'Example Patient',
        diagnosed: false,
        number_of_transfusion: 0,
        isActive: true
      });

      const response = await request(app)
        .put(`/api/patients/${testPatient._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ registered_no: 'PAT002' });

      expect(response.status).toBe(409);
      expect(response.body.message).toContain('already exists');
    });

    it('should return 404 when updating non-existent patient', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .put(`/api/patients/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ patient_name: 'Missing Patient' });

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });

    it('should filter patients by search term', async () => {
      const response = await request(app)
        .get('/api/patients?search=Sample')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.patients.length).toBe(1);
      expect(response.body.data.patients[0].patient_name).toBe('Sample Patient');
    });

    it('should filter patients by diagnosis status', async () => {
      const response = await request(app)
        .get('/api/patients?diagnosed=true')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.patients.length).toBe(1);
      expect(response.body.data.patients[0].diagnosed).toBe(true);
    });

    it('should paginate patient results', async () => {
      // Create additional patients for pagination test
      await Patient.create([
        {
          registered_date: toBs('2024-03-01'),
          registered_no: 'PAT003',
          patient_name: 'Patient Three',
          diagnosed: true,
          number_of_transfusion: 3,
          isActive: true
        },
        {
          registered_date: toBs('2024-04-01'),
          registered_no: 'PAT004',
          patient_name: 'Patient Four',
          diagnosed: false,
          number_of_transfusion: 1,
          isActive: true
        }
      ]);

      const response = await request(app)
        .get('/api/patients?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.patients.length).toBe(2);
      expect(response.body.data.pagination.total).toBe(3);
      expect(response.body.data.pagination.pages).toBe(2);
    });

    it('should return 404 when deleting non-existent patient', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/patients/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('not found');
    });
  });

  describe('Document Operations', () => {
    const uploadDocument = async () => {
      const response = await request(app)
        .post(`/api/patients/${testPatient._id}/documents`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', 'Test-Agent/1.0')
        .field('documentType', 'diagnosis_report')
        .field('issuingAuthority', 'City Hospital')
        .attach('file', Buffer.from('fake pdf content'), 'test-report.pdf');

      expect(response.status).toBe(201);
      return response.body.data.document;
    };

    it('should upload document for patient', async () => {
      const response = await request(app)
        .post(`/api/patients/${testPatient._id}/documents`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', 'Test-Agent/1.0')
        .field('documentType', 'diagnosis_report')
        .field('issuingAuthority', 'City Hospital')
        .attach('file', Buffer.from('fake pdf content'), 'test-report.pdf');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.document.documentType).toBe('diagnosis_report');
      expect(response.body.data.document.patientId).toBe(testPatient._id.toString());
    });

    it('should reject upload for non-existent patient', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post(`/api/patients/${fakeId}/documents`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('documentType', 'diagnosis_report')
        .attach('file', Buffer.from('fake pdf content'), 'test-report.pdf');

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Patient not found');
    });

    it('should get documents for patient', async () => {
      // First upload a document
      await request(app)
        .post(`/api/patients/${testPatient._id}/documents`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', 'Test-Agent/1.0')
        .field('documentType', 'diagnosis_report')
        .attach('file', Buffer.from('fake pdf content'), 'test-report.pdf');

      // Then get documents
      const response = await request(app)
        .get(`/api/patients/${testPatient._id}/documents`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', 'Test-Agent/1.0');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.documents.length).toBe(1);
      expect(response.body.data.documents[0].documentType).toBe('diagnosis_report');
    });

    it('should reject verify for non-reviewer users', async () => {
      const document = await uploadDocument();

      const response = await request(app)
        .patch(`/api/patients/${testPatient._id}/documents/${document._id}/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ remarks: 'Looks good' });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should verify document with reviewer role', async () => {
      const document = await uploadDocument();

      const response = await request(app)
        .patch(`/api/patients/${testPatient._id}/documents/${document._id}/verify`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ remarks: 'Verified' });

      expect(response.status).toBe(200);
      expect(response.body.data.document.status).toBe('verified');
      expect(response.body.data.document.remarks).toBe('Verified');
    });

    it('should require remarks when rejecting a document', async () => {
      const document = await uploadDocument();

      const response = await request(app)
        .patch(`/api/patients/${testPatient._id}/documents/${document._id}/reject`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ remarks: '' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Remarks are required');
    });

    it('should reject document with reviewer role', async () => {
      const document = await uploadDocument();

      const response = await request(app)
        .patch(`/api/patients/${testPatient._id}/documents/${document._id}/reject`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ remarks: 'Blurry scan' });

      expect(response.status).toBe(200);
      expect(response.body.data.document.status).toBe('rejected');
      expect(response.body.data.document.remarks).toBe('Blurry scan');
    });

    it('should download a document', async () => {
      const document = await uploadDocument();

      const response = await request(app)
        .get(`/api/patients/${testPatient._id}/documents/${document._id}/download`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', 'Test-Agent/1.0');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('test-report.pdf');
    }, 15000);

    it('should return 404 when downloading missing document', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/patients/${testPatient._id}/documents/${fakeId}/download`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('Document not found');
    });

    it('should allow admin to delete document', async () => {
      const document = await uploadDocument();

      const response = await request(app)
        .delete(`/api/patients/${testPatient._id}/documents/${document._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted successfully');

      const deletedDocument = await Document.findById(document._id);
      expect(deletedDocument?.isActive).toBe(false);
    });

    it('should reject document delete for non-admin users', async () => {
      const document = await uploadDocument();

      const response = await request(app)
        .delete(`/api/patients/${testPatient._id}/documents/${document._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should return document statistics', async () => {
      await uploadDocument();
      await uploadDocument();

      const response = await request(app)
        .get(`/api/patients/${testPatient._id}/documents/statistics`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.stats)).toBe(true);
      expect(response.body.data.stats.length).toBeGreaterThan(0);
    });

    it('should reject document upload without file', async () => {
      const response = await request(app)
        .post(`/api/patients/${testPatient._id}/documents`)
        .set('Authorization', `Bearer ${authToken}`)
        .field('documentType', 'diagnosis_report');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('No file uploaded');
    });

    it('should reject invalid document type', async () => {
      const response = await request(app)
        .post(`/api/patients/${testPatient._id}/documents`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', 'Test-Agent/1.0')
        .field('documentType', 'invalid_type')
        .attach('file', Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n'), 'test.pdf');

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid document type');
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body).toHaveProperty('database');
      expect(response.body.message).toContain('Server is running');
    });
  });
});
