import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app.js';
import { Patient } from '../../src/models/Patient.js';
import { User, UserRole } from '../../src/models/User.js';
import { Document } from '../../src/models/Document.js';
import bcrypt from 'bcryptjs';
import { toBs } from '../utils/bsDate.js';

let app: any;
let mongoServer: MongoMemoryServer;
let authToken: string;
let adminToken: string;
let testPatient: any;

// Helper functions for API requests
let apiRequest: (method: string, url: string) => any;
let adminApiRequest: (method: string, url: string) => any;

/**
 * Patient API Integration Tests
 * Focused on patient-specific operations and edge cases
 */
describe('Patient API Integration Tests', () => {
  beforeEach(async () => {
    // Clear all data before each test
    await User.deleteMany({});
    await Patient.deleteMany({});
    await Document.deleteMany({});

    // Create regular test user
    const hashedPassword = await bcrypt.hash('testpassword123', 10);
    const userData = {
      email: 'test@example.com',
      name: 'Test User',
      password_hash: hashedPassword,
      role: UserRole.DATA_ENTRY,
      isActive: true,
      created_at: new Date(),
      updated_at: new Date()
    };
    const userDoc = await mongoose.connection.db.collection('users').insertOne(userData);
    await User.findById(userDoc.insertedId);

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    const adminData = {
      email: 'admin@example.com',
      name: 'Admin User',
      password_hash: adminPassword,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
      created_at: new Date(),
      updated_at: new Date()
    };
    await mongoose.connection.db.collection('users').insertOne(adminData);

    // Login to get tokens
    const userLoginResponse = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Test-Agent/1.0')
      .send({
        email: 'test@example.com',
        password: 'testpassword123'
      });
    authToken = userLoginResponse.body.token;

    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .set('User-Agent', 'Test-Agent/1.0')
      .send({
        email: 'admin@example.com',
        password: 'admin123'
      });
    adminToken = adminLoginResponse.body.token;

    // Helper function to add common headers
    apiRequest = (method: string, url: string) => {
      return request(app)[method](url)
        .set('Authorization', `Bearer ${authToken}`)
        .set('User-Agent', 'Test-Agent/1.0');
    };

    // Helper function for admin requests
    adminApiRequest = (method: string, url: string) => {
      return request(app)[method](url)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('User-Agent', 'Test-Agent/1.0');
    };

    // Create test patient
    testPatient = await Patient.create({
      registered_date: toBs('2024-01-15'),
      registered_no: 'PAT001',
      patient_name: 'Sample Patient',
      diagnosed: true,
      number_of_transfusion: 5,
      gender: 'Male',
      blood_group: 'A+',
      dob: toBs('1990-01-01'),
      isActive: true
    });
  });

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

    console.log('✅ Patient API test database initialized');
  }, 30000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
    console.log('✅ Patient API test database cleaned up');
  }, 30000);


  describe('Patient Data Validation', () => {
    it('should validate all required patient fields', async () => {
      const incompletePatient = {
        registered_date: toBs('2024-02-20'),
        // Missing registered_no and patient_name
        diagnosed: false
      };

      const response = await apiRequest('post', '/api/patients')
        .send(incompletePatient);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('registered number');
      expect(response.body.message).toContain('patient name');
    });

    it('should accept patient with all optional fields', async () => {
      const completePatient = {
        registered_date: toBs('2024-02-20'),
        registered_no: 'PAT002',
        patient_name: 'Complete Patient',
        membership_type: 'Life',
        dob: toBs('1985-03-15'),
        gender: 'Female',
        blood_group: 'O+',
        diagnosed: true,
        diagnosed_date: toBs('2024-01-10'),
        diagnosed_by: 'Dr. Example Clinician',
        first_transfusion: toBs('2024-01-15'),
        number_of_transfusion: 3,
        complications: 'Mild reactions',
        iron_chelation: 'Deferasirox',
        health_condition: 'Stable',
        address_permanent: '123 Main St, City, State',
        mobile_permanent: '+1234567890',
        father_name: 'Parent One',
        father_birth_place: 'Same City',
        mother_name: 'Example Patient',
        mother_birth_place: 'Another City'
      };

      const response = await apiRequest('post', '/api/patients')
        .send(completePatient);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.patient.registered_no).toBe('PAT002');
      expect(response.body.data.patient.membership_type).toBe('Life');
      expect(response.body.data.patient.blood_group).toBe('O+');
    });

    it('should handle date fields correctly', async () => {
      const patientWithDates = {
        registered_date: toBs('2024-02-20'),
        registered_no: 'PAT003',
        patient_name: 'Date Test Patient',
        diagnosed: true,
        dob: toBs('1995-06-10'),
        diagnosed_date: toBs('2024-02-01'),
        first_transfusion: toBs('2024-02-15')
      };

      const response = await apiRequest('post', '/api/patients')
        .send(patientWithDates);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify dates are stored correctly
      const savedPatient = await Patient.findById(response.body.data.patient._id);
      expect(savedPatient?.registered_date).toBeTypeOf('string');
      expect(savedPatient?.dob).toBeTypeOf('string');
      expect(savedPatient?.diagnosed_date).toBeTypeOf('string');
    });
  });

  describe('Patient Search and Filtering', () => {
    beforeEach(async () => {
      // Create additional test patients for filtering
      await Patient.insertMany([
        {
          registered_date: toBs('2024-01-10'),
          registered_no: 'PAT010',
          patient_name: 'Alpha Patient',
          diagnosed: false,
          gender: 'Female',
          blood_group: 'B+',
          number_of_transfusion: 0,
          isActive: true
        },
        {
          registered_date: toBs('2024-01-20'),
          registered_no: 'PAT011',
          patient_name: 'Beta Patient',
          diagnosed: true,
          gender: 'Male',
          blood_group: 'AB+',
          number_of_transfusion: 8,
          isActive: true
        },
        {
          registered_date: toBs('2024-02-01'),
          registered_no: 'PAT012',
          patient_name: 'Gamma Patient',
          diagnosed: true,
          gender: 'Female',
          blood_group: 'A+',
          number_of_transfusion: 12,
          isActive: true
        }
      ]);
    });

    it('should search patients by name', async () => {
      const response = await apiRequest('get', '/api/patients?search=Sample')
;

      expect(response.status).toBe(200);
      expect(response.body.data.patients.length).toBe(1); // Fuzzy match (Sample Patient)
    });

    it('should search patients by registration number', async () => {
      const response = await apiRequest('get', '/api/patients?search=PAT01')
;

      expect(response.status).toBe(200);
      expect(response.body.data.patients.length).toBe(4);
    });

    it('should fuzzy search patients by registration number', async () => {
      const response = await apiRequest('get', '/api/patients?search=P01');

      expect(response.status).toBe(200);
      const regNos = response.body.data.patients.map((p: any) => p.registered_no);
      expect(regNos).toContain('PAT001');
      expect(regNos).toContain('PAT010');
      expect(regNos).toContain('PAT011');
      expect(regNos).toContain('PAT012');
    });

    it('should fuzzy search patients by name', async () => {
      const response = await apiRequest('get', '/api/patients?search=Sample');

      expect(response.status).toBe(200);
      const names = response.body.data.patients.map((p: any) => p.patient_name);
      expect(names).toContain('Sample Patient');
    });

    it('should paginate patients list', async () => {
      const response = await apiRequest('get', '/api/patients?limit=2&page=2');

      expect(response.status).toBe(200);
      expect(response.body.data.patients.length).toBe(2);
      expect(response.body.data.pagination.total).toBe(4);
      expect(response.body.data.pagination.pages).toBe(2);
      expect(response.body.data.pagination.page).toBe(2);
    });

    it('should paginate search results', async () => {
      const response = await apiRequest('get', '/api/patients?search=PAT0&limit=1&page=2');

      expect(response.status).toBe(200);
      expect(response.body.data.patients.length).toBe(1);
      expect(response.body.data.pagination.total).toBe(4);
      expect(response.body.data.pagination.pages).toBe(4);
      expect(response.body.data.pagination.page).toBe(2);
    });

    it('should filter by diagnosis status', async () => {
      const diagnosedResponse = await apiRequest('get', '/api/patients?diagnosed=true');

      const undiagnosedResponse = await apiRequest('get', '/api/patients?diagnosed=false');

      expect(diagnosedResponse.status).toBe(200);
      expect(undiagnosedResponse.status).toBe(200);
      expect(diagnosedResponse.body.data.patients.length).toBe(3); // Sample Patient, Beta Patient, and Gamma Patient
      expect(undiagnosedResponse.body.data.patients.length).toBe(1); // Alpha Patient
    });

    it('should filter by gender', async () => {
      const maleResponse = await apiRequest('get', '/api/patients?gender=Male');

      const femaleResponse = await apiRequest('get', '/api/patients?gender=Female');

      expect(maleResponse.status).toBe(200);
      expect(femaleResponse.status).toBe(200);
      expect(maleResponse.body.data.patients.length).toBe(2); // Sample Patient and Beta Patient
      expect(femaleResponse.body.data.patients.length).toBe(2); // Alpha Patient and Gamma Patient
    });

    it('should filter by blood group', async () => {

      const response = await apiRequest('get', '/api/patients?blood_group=A%2B')
;

      expect(response.status).toBe(200);
      expect(response.body.data.patients.length).toBe(2); // Sample Patient and Gamma Patient
    });

    it('should sort patients by creation date (default)', async () => {
      const response = await apiRequest('get', '/api/patients?limit=10');

      expect(response.status).toBe(200);
      expect(response.body.data.patients.length).toBeGreaterThan(1);

      // Check that patients are sorted by creation date (newest first by default)
      const patients = response.body.data.patients;
      for (let i = 1; i < patients.length; i++) {
        const prevDate = new Date(patients[i-1].created_at);
        const currDate = new Date(patients[i].created_at);
        expect(prevDate.getTime()).toBeGreaterThanOrEqual(currDate.getTime());
      }
    });

    it('should sort patients by registration number', async () => {
      const response = await apiRequest('get', '/api/patients?sortBy=registered_no&sortOrder=asc');

      expect(response.status).toBe(200);
      const patients = response.body.data.patients;
      expect(patients[0].registered_no).toBe('PAT001');
      expect(patients[patients.length - 1].registered_no).toBe('PAT012');
    });
  });

  describe('Patient Soft Delete', () => {
    it('should soft delete patient as admin', async () => {
      const response = await adminApiRequest('delete', `/api/patients/${testPatient._id}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted successfully');

      // Verify patient is marked as inactive
      const deletedPatient = await Patient.findById(testPatient._id);
      expect(deletedPatient?.isActive).toBe(false);
    });

    it('should reject soft delete for non-admin users', async () => {
      const response = await apiRequest('delete', `/api/patients/${testPatient._id}`); // Regular user token

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('permissions');
    });

    it('should not include inactive patients in regular queries', async () => {
      // Soft delete the patient
      await adminApiRequest('delete', `/api/patients/${testPatient._id}`);

      // Query patients - should not include the deleted one
      const response = await apiRequest('get', '/api/patients');

      expect(response.status).toBe(200);
      const patientIds = response.body.data.patients.map((p: any) => p._id);
      expect(patientIds).not.toContain(testPatient._id.toString());
    });
  });

  describe('Patient Statistics', () => {
    beforeEach(async () => {
      // Create diverse patient data for statistics
      await Patient.create([
        {
        registered_date: toBs('2024-01-10'),
          registered_no: 'STAT001',
          patient_name: 'Female Patient 1',
          diagnosed: true,
          gender: 'Female',
          blood_group: 'A+',
          number_of_transfusion: 5,
        dob: toBs('1980-01-01'),
          isActive: true
        },
        {
        registered_date: toBs('2024-01-15'),
          registered_no: 'STAT002',
          patient_name: 'Female Patient 2',
          diagnosed: false,
          gender: 'Female',
          blood_group: 'B+',
          number_of_transfusion: 0,
        dob: toBs('1990-01-01'),
          isActive: true
        },
        {
        registered_date: toBs('2024-01-20'),
          registered_no: 'STAT003',
          patient_name: 'Male Patient 1',
          diagnosed: true,
          gender: 'Male',
          blood_group: 'O+',
          number_of_transfusion: 8,
        dob: toBs('1975-01-01'),
          isActive: true
        }
      ]);
    });

    it('should return comprehensive patient statistics', async () => {
      const response = await adminApiRequest('get', '/api/patients/statistics/overview');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overview');
      expect(response.body.data).toHaveProperty('demographics');

      // Check overview statistics
      const overview = response.body.data.overview;
      expect(overview).toHaveProperty('totalPatients');
      expect(overview).toHaveProperty('diagnosedPatients');
      expect(overview).toHaveProperty('undiagnosedPatients');
      expect(overview).toHaveProperty('diagnosisRate');

      // Should have 4 total patients (3 created + 1 from beforeEach)
      expect(overview.totalPatients).toBe(4);
      expect(overview.diagnosedPatients).toBe(3); // Sample Patient + Female Patient 1 + Male Patient 1
      expect(overview.undiagnosedPatients).toBe(1); // Female Patient 2

      // Check demographics
      const demographics = response.body.data.demographics;
      expect(demographics).toHaveProperty('gender');
      expect(demographics).toHaveProperty('averageAge');
      expect(demographics).toHaveProperty('bloodGroups');

      // Check gender distribution
      expect(demographics.gender.female).toBe(2);
      expect(demographics.gender.male).toBe(2);
      expect(demographics.gender.other).toBe(0);

      // Check blood groups
      expect(demographics.bloodGroups['A+']).toBe(2);
      expect(demographics.bloodGroups['B+']).toBe(1);
      expect(demographics.bloodGroups['O+']).toBe(1);
    });
  });

  describe('Patient Document Integration', () => {
    it('should get patient with documents when requested', async () => {
      // First create a document for the patient
      await apiRequest('post', `/api/patients/${testPatient._id}/documents`)
        .field('documentType', 'diagnosis_report')
        .field('issuingAuthority', 'Test Hospital')
        .attach('file', Buffer.from('fake pdf content'), 'diagnosis.pdf');

      // Get patient with documents
      const response = await apiRequest('get', `/api/patients/${testPatient._id}?includeDocuments=true`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.patient._id).toBe(testPatient._id.toString());
      expect(response.body.data).toHaveProperty('documents');
      expect(Array.isArray(response.body.data.documents)).toBe(true);
      expect(response.body.data.documents.length).toBe(1);
    });

    it('should get patient without documents by default', async () => {
      const response = await apiRequest('get', `/api/patients/${testPatient._id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.patient._id).toBe(testPatient._id.toString());
      expect(response.body.data).not.toHaveProperty('documents');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid patient ID gracefully', async () => {
      const response = await apiRequest('get', '/api/patients/invalid-id');

      expect(response.status).toBe(500); // Mongoose will throw an error for invalid ObjectId
    });

    it('should handle malformed request data', async () => {
      const response = await apiRequest('post', '/api/patients')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    it('should handle database connection issues', async () => {
      // Temporarily disconnect from database
      await mongoose.disconnect();

      const response = await apiRequest('get', '/api/patients');

      // Should still get a response (may be error, but not crash)
      expect(response.status).toBeDefined();

      // Reconnect for other tests
      if (mongoServer) {
        const mongoUrl = mongoServer.getUri();
        await mongoose.connect(mongoUrl);
      }
    });
  });
});
