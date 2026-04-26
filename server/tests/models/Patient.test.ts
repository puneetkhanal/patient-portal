// tests/models/Patient.test.ts
import mongoose from 'mongoose';
import {
  connectTestDatabase,
  disconnectTestDatabase,
  clearTestDatabase,
  seedTestDatabase
} from '../db/setup.js';
import { Patient } from '../../src/models/Patient.js';
import { Document, DocumentType, DocumentStatus } from '../../src/models/Document.js';
import { User } from '../../src/models/User.js';
import { toBs } from '../utils/bsDate.js';

describe('Patient Model', () => {
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

  describe('Schema Validation', () => {
    it('should create a valid patient', async () => {
      const patientData = {
        registered_date: toBs('2024-01-15'),
        registered_no: 'PAT003',
        patient_name: 'Test Patient',
        diagnosed: true,
        number_of_transfusion: 3,
        blood_group: 'A+',
        gender: 'Male',
        dob: toBs('2010-05-20')
      };

      const patient = await Patient.create(patientData);

      expect(patient._id).toBeDefined();
      expect(patient.registered_no).toBe('PAT003');
      expect(patient.patient_name).toBe('Test Patient');
      expect(patient.diagnosed).toBe(true);
      expect(patient.number_of_transfusion).toBe(3);
      expect(patient.blood_group).toBe('A+');
      expect(patient.gender).toBe('Male');
      expect(patient.created_at).toBeInstanceOf(Date);
      expect(patient.updated_at).toBeInstanceOf(Date);
    });

    it('should require registered_date, registered_no and patient_name', async () => {
      const incompleteData = {
        registered_no: 'PAT004',
        patient_name: 'Incomplete Patient'
      };

      await expect(Patient.create(incompleteData)).rejects.toThrow();
    });

    it('should enforce unique registered_no', async () => {
      await Patient.create({
        registered_date: toBs('2024-01-01'),
        registered_no: 'PAT005',
        patient_name: 'Patient One',
        diagnosed: false,
        number_of_transfusion: 0
      });

      const patient2 = Patient.create({
        registered_date: toBs('2024-01-01'),
        registered_no: 'PAT005',
        patient_name: 'Patient Two',
        diagnosed: false,
        number_of_transfusion: 0
      });

      await expect(patient2).rejects.toThrow();
    });

    it('should validate blood_group enum values', async () => {
      const patientData = {
        registered_date: toBs('2024-01-02'),
        registered_no: 'PAT006',
        patient_name: 'Invalid Blood Group',
        diagnosed: false,
        number_of_transfusion: 0,
        blood_group: 'INVALID'
      };

      await expect(Patient.create(patientData)).rejects.toThrow();
    });

    it('should validate gender enum values', async () => {
      const patientData = {
        registered_date: toBs('2024-01-03'),
        registered_no: 'PAT007',
        patient_name: 'Invalid Gender',
        diagnosed: false,
        number_of_transfusion: 0,
        gender: 'INVALID'
      };

      await expect(Patient.create(patientData)).rejects.toThrow();
    });

    it('should set default values for diagnosed and number_of_transfusion', async () => {
      const patientData = {
        registered_date: toBs('2024-01-04'),
        registered_no: 'PAT008',
        patient_name: 'Default Values Patient'
      };

      const patient = await Patient.create(patientData);

      expect(patient.diagnosed).toBe(false);
      expect(patient.number_of_transfusion).toBe(0);
    });
  });

  describe('Virtual Fields', () => {
    let patient;
    let user;

    beforeEach(async () => {
      patient = await Patient.findOne({ registered_no: 'PAT001' });
      user = await User.findOne({ email: 'test@example.com' });

      const mockDocuments = [
        {
          patientId: patient._id,
          documentType: DocumentType.PATIENT_PHOTO,
          fileName: 'photo.jpg',
          filePath: '/test/photo.jpg',
          fileSize: 1024,
          mimeType: 'image/jpeg',
          uploadedBy: user._id,
          status: DocumentStatus.VERIFIED,
          uploadDate: new Date('2024-01-10')
        },
        {
          patientId: patient._id,
          documentType: DocumentType.DIAGNOSIS_REPORT,
          fileName: 'diagnosis.pdf',
          filePath: '/test/diagnosis.pdf',
          fileSize: 2048,
          mimeType: 'application/pdf',
          uploadedBy: user._id,
          status: DocumentStatus.VERIFIED,
          uploadDate: new Date('2024-01-15')
        },
        {
          patientId: patient._id,
          documentType: DocumentType.CITIZENSHIP_PATIENT,
          fileName: 'citizenship.pdf',
          filePath: '/test/citizenship.pdf',
          fileSize: 3072,
          mimeType: 'application/pdf',
          uploadedBy: user._id,
          status: DocumentStatus.PENDING,
          uploadDate: new Date('2024-01-12')
        },
        {
          patientId: patient._id,
          documentType: DocumentType.CITIZENSHIP_FATHER,
          fileName: 'father_citizenship.pdf',
          filePath: '/test/father_citizenship.pdf',
          fileSize: 3072,
          mimeType: 'application/pdf',
          uploadedBy: user._id,
          status: DocumentStatus.VERIFIED,
          uploadDate: new Date('2024-01-13')
        },
        {
          patientId: patient._id,
          documentType: DocumentType.LAB_REPORT,
          fileName: 'lab.pdf',
          filePath: '/test/lab.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedBy: user._id,
          status: DocumentStatus.REJECTED,
          uploadDate: new Date('2024-01-14')
        }
      ];

      await Document.insertMany(mockDocuments);
    });

    it('should populate documents virtual field', async () => {
      const populatedPatient = await Patient.findById(patient._id).populate('documents');

      expect(populatedPatient.documents).toBeDefined();
      expect(populatedPatient.documents.length).toBe(5);
      expect(populatedPatient.documents[0].patientId.toString()).toBe(patient._id.toString());
    });

    it('should populate patientPhoto virtual field', async () => {
      const populatedPatient = await Patient.findById(patient._id).populate('patientPhoto');

      expect(populatedPatient.patientPhoto).toBeDefined();
      expect(populatedPatient.patientPhoto.documentType).toBe(DocumentType.PATIENT_PHOTO);
      expect(populatedPatient.patientPhoto.status).toBe(DocumentStatus.VERIFIED);
    });

    it('should populate diagnosisReport virtual field', async () => {
      const populatedPatient = await Patient.findById(patient._id).populate('diagnosisReport');

      expect(populatedPatient.diagnosisReport).toBeDefined();
      expect(populatedPatient.diagnosisReport.documentType).toBe(DocumentType.DIAGNOSIS_REPORT);
    });

    it('should populate citizenshipDocuments virtual field', async () => {
      const populatedPatient = await Patient.findById(patient._id).populate('citizenshipDocuments');

      expect(populatedPatient.citizenshipDocuments).toBeDefined();
      expect(populatedPatient.citizenshipDocuments.length).toBe(2);

      const docTypes = populatedPatient.citizenshipDocuments.map(doc => doc.documentType);
      expect(docTypes).toContain(DocumentType.CITIZENSHIP_PATIENT);
      expect(docTypes).toContain(DocumentType.CITIZENSHIP_FATHER);
    });

    it('should not include inactive documents in virtual fields', async () => {
      const labReport = await Document.findOne({ documentType: DocumentType.LAB_REPORT });
      labReport.isActive = false;
      await labReport.save();

      const populatedPatient = await Patient.findById(patient._id).populate('documents');

      expect(populatedPatient.documents.length).toBe(4);
      const labReportExists = populatedPatient.documents.some(
        doc => doc.documentType === DocumentType.LAB_REPORT
      );
      expect(labReportExists).toBe(false);
    });
  });

  describe('Static Methods', () => {
    let patient;
    let user;

    beforeEach(async () => {
      patient = await Patient.findOne({ registered_no: 'PAT001' });
      user = await User.findOne({ email: 'test@example.com' });

      const mockDocuments = [
        {
          patientId: patient._id,
          documentType: DocumentType.DIAGNOSIS_REPORT,
          fileName: 'diag1.pdf',
          filePath: '/test/diag1.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedBy: user._id,
          status: DocumentStatus.VERIFIED
        },
        {
          patientId: patient._id,
          documentType: DocumentType.PATIENT_PHOTO,
          fileName: 'photo1.jpg',
          filePath: '/test/photo1.jpg',
          fileSize: 2048,
          mimeType: 'image/jpeg',
          uploadedBy: user._id,
          status: DocumentStatus.VERIFIED
        },
        {
          patientId: patient._id,
          documentType: DocumentType.DIAGNOSIS_REPORT,
          fileName: 'diag2.pdf',
          filePath: '/test/diag2.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedBy: user._id,
          status: DocumentStatus.PENDING
        }
      ];

      await Document.insertMany(mockDocuments);
    });

    describe('findByIdWithDocuments', () => {
      it('should return patient with all documents', async () => {
        const result = await Patient.findByIdWithDocuments(patient._id);

        expect(result).toBeDefined();
        expect(result._id.toString()).toBe(patient._id.toString());
        expect(result.documents).toBeDefined();
        expect(result.documents.length).toBe(3);
      });

      it('should filter documents by type', async () => {
        const result = await Patient.findByIdWithDocuments(patient._id, {
          documentTypes: [DocumentType.DIAGNOSIS_REPORT]
        });

        expect(result.documents.length).toBe(2);
        result.documents.forEach(doc => {
          expect(doc.documentType).toBe(DocumentType.DIAGNOSIS_REPORT);
        });
      });

      it('should populate uploader information', async () => {
        const result = await Patient.findByIdWithDocuments(patient._id, {
          populateUploader: true
        });

        expect(result.documents[0].uploader).toBeDefined();
        expect(result.documents[0].uploader._id.toString()).toBe(user._id.toString());
      });

      it('should include inactive documents when requested', async () => {
        const doc = await Document.findOne({ documentType: DocumentType.DIAGNOSIS_REPORT });
        doc.isActive = false;
        await doc.save();

        const resultWithoutInactive = await Patient.findByIdWithDocuments(patient._id);
        expect(resultWithoutInactive.documents.length).toBe(2);

        const resultWithInactive = await Patient.findByIdWithDocuments(patient._id, {
          includeInactive: true
        });
        expect(resultWithInactive.documents.length).toBe(3);
      });

      it('should return null for non-existent patient', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        const result = await Patient.findByIdWithDocuments(nonExistentId);

        expect(result).toBeNull();
      });
    });

    describe('getDocumentStats', () => {
      it('should return document statistics for patient', async () => {
        const stats = await Patient.getDocumentStats(patient._id);

        expect(Array.isArray(stats)).toBe(true);
        expect(stats.length).toBeGreaterThan(0);

        const diagnosisStats = stats.find(s => s._id === DocumentType.DIAGNOSIS_REPORT);
        expect(diagnosisStats).toBeDefined();
        expect(diagnosisStats.count).toBe(2);
        expect(diagnosisStats.verified).toBe(1);
        expect(diagnosisStats.pending).toBe(1);
      });

      it('should return empty array for patient with no documents', async () => {
        const newPatient = await Patient.create({
          registered_date: toBs('2024-01-05'),
          registered_no: 'PAT009',
          patient_name: 'No Docs Patient',
          diagnosed: false,
          number_of_transfusion: 0
        });

        const stats = await Patient.getDocumentStats(newPatient._id);
        expect(stats).toEqual([]);
      });
    });
  });

  describe('Instance Methods', () => {
    let patient;
    let user;

    beforeEach(async () => {
      patient = await Patient.findOne({ registered_no: 'PAT001' });
      user = await User.findOne({ email: 'test@example.com' });
    });

    describe('addDocument', () => {
      it('should add a document to the patient', async () => {
        const documentData = {
          documentType: DocumentType.DIAGNOSIS_REPORT,
          fileName: 'new_diagnosis.pdf',
          filePath: '/test/new_diagnosis.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedBy: user._id,
          metadata: { source: 'hospital' },
          issuingAuthority: 'City Hospital'
        };

        const document = await patient.addDocument(documentData);

        expect(document).toBeDefined();
        expect(document.patientId.toString()).toBe(patient._id.toString());
        expect(document.documentType).toBe(DocumentType.DIAGNOSIS_REPORT);
        expect(document.fileName).toBe('new_diagnosis.pdf');
        expect(document.metadata).toEqual({ source: 'hospital' });
        expect(document.issuingAuthority).toBe('City Hospital');
        expect(document.status).toBe(DocumentStatus.PENDING);
      });

      it('should create document with minimal required data', async () => {
        const documentData = {
          documentType: DocumentType.PATIENT_PHOTO,
          fileName: 'photo.jpg',
          filePath: '/test/photo.jpg',
          fileSize: 1024,
          mimeType: 'image/jpeg',
          uploadedBy: user._id
        };

        const document = await patient.addDocument(documentData);

        expect(document).toBeDefined();
        expect(document.patientId.toString()).toBe(patient._id.toString());
        expect(document.documentType).toBe(DocumentType.PATIENT_PHOTO);
      });
    });

    describe('getRequiredDocumentsStatus', () => {
      beforeEach(async () => {
        await Document.deleteMany({ patientId: patient._id });
      });

      it('should return false when no required documents exist', async () => {
        const status = await patient.getRequiredDocumentsStatus();

        expect(status.isComplete).toBe(false);
        expect(status.details[DocumentType.DIAGNOSIS_REPORT]).toBe(false);
        expect(status.details[DocumentType.CITIZENSHIP_PATIENT]).toBe(false);
      });

      it('should return false when only one required document exists', async () => {
        await Document.create({
          patientId: patient._id,
          documentType: DocumentType.DIAGNOSIS_REPORT,
          fileName: 'diagnosis.pdf',
          filePath: '/test/diagnosis.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedBy: user._id,
          status: DocumentStatus.VERIFIED
        });

        const status = await patient.getRequiredDocumentsStatus();

        expect(status.isComplete).toBe(false);
        expect(status.details[DocumentType.DIAGNOSIS_REPORT]).toBe(true);
        expect(status.details[DocumentType.CITIZENSHIP_PATIENT]).toBe(false);
      });

      it('should return true when all required documents exist and are verified', async () => {
        await Document.create([
          {
            patientId: patient._id,
            documentType: DocumentType.DIAGNOSIS_REPORT,
            fileName: 'diagnosis.pdf',
            filePath: '/test/diagnosis.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            uploadedBy: user._id,
            status: DocumentStatus.VERIFIED
          },
          {
            patientId: patient._id,
            documentType: DocumentType.CITIZENSHIP_PATIENT,
            fileName: 'citizenship.pdf',
            filePath: '/test/citizenship.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            uploadedBy: user._id,
            status: DocumentStatus.VERIFIED
          }
        ]);

        const status = await patient.getRequiredDocumentsStatus();

        expect(status.isComplete).toBe(true);
        expect(status.details[DocumentType.DIAGNOSIS_REPORT]).toBe(true);
        expect(status.details[DocumentType.CITIZENSHIP_PATIENT]).toBe(true);
      });

      it('should return false when required documents exist but are not verified', async () => {
        await Document.create([
          {
            patientId: patient._id,
            documentType: DocumentType.DIAGNOSIS_REPORT,
            fileName: 'diagnosis.pdf',
            filePath: '/test/diagnosis.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            uploadedBy: user._id,
            status: DocumentStatus.PENDING
          },
          {
            patientId: patient._id,
            documentType: DocumentType.CITIZENSHIP_PATIENT,
            fileName: 'citizenship.pdf',
            filePath: '/test/citizenship.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            uploadedBy: user._id,
            status: DocumentStatus.PENDING
          }
        ]);

        const status = await patient.getRequiredDocumentsStatus();

        expect(status.isComplete).toBe(false);
        expect(status.details[DocumentType.DIAGNOSIS_REPORT]).toBe(false);
        expect(status.details[DocumentType.CITIZENSHIP_PATIENT]).toBe(false);
      });

      it('should return false when required documents are rejected', async () => {
        await Document.create([
          {
            patientId: patient._id,
            documentType: DocumentType.DIAGNOSIS_REPORT,
            fileName: 'diagnosis.pdf',
            filePath: '/test/diagnosis.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            uploadedBy: user._id,
            status: DocumentStatus.REJECTED
          }
        ]);

        const status = await patient.getRequiredDocumentsStatus();

        expect(status.isComplete).toBe(false);
        expect(status.details[DocumentType.DIAGNOSIS_REPORT]).toBe(false);
      });
    });
  });

  describe('Middleware', () => {
    let patient;
    let user;

    beforeEach(async () => {
      patient = await Patient.findOne({ registered_no: 'PAT001' });
      user = await User.findOne({ email: 'test@example.com' });

      await Document.create([
        {
          patientId: patient._id,
          documentType: DocumentType.DIAGNOSIS_REPORT,
          fileName: 'doc1.pdf',
          filePath: '/test/doc1.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          uploadedBy: user._id,
          status: DocumentStatus.VERIFIED,
          isActive: true
        },
        {
          patientId: patient._id,
          documentType: DocumentType.PATIENT_PHOTO,
          fileName: 'photo.jpg',
          filePath: '/test/photo.jpg',
          fileSize: 2048,
          mimeType: 'image/jpeg',
          uploadedBy: user._id,
          status: DocumentStatus.VERIFIED,
          isActive: true
        }
      ]);
    });

    it('should soft delete related documents when patient is deleted', async () => {
      await Patient.findByIdAndDelete(patient._id);

      const documents = await Document.find({ patientId: patient._id });

      expect(documents).toHaveLength(2);
      documents.forEach(doc => {
        expect(doc.isActive).toBe(false);
      });
    });

    it('should not affect documents of other patients', async () => {
      const otherPatient = await Patient.findOne({ registered_no: 'PAT002' });

      await Document.create({
        patientId: otherPatient._id,
        documentType: DocumentType.DIAGNOSIS_REPORT,
        fileName: 'other.pdf',
        filePath: '/test/other.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        uploadedBy: user._id,
        status: DocumentStatus.VERIFIED,
        isActive: true
      });

      await Patient.findByIdAndDelete(patient._id);

      const otherPatientDocs = await Document.find({ patientId: otherPatient._id });
      expect(otherPatientDocs).toHaveLength(1);
      expect(otherPatientDocs[0].isActive).toBe(true);
    });
  });

  describe('Indexes and Queries', () => {
    beforeEach(async () => {
      await Patient.deleteMany({});

      // Create patients sequentially to ensure proper timestamp ordering
      await Patient.create({
        registered_date: toBs('2023-01-01'),
        registered_no: 'PAT010',
        patient_name: 'Alpha Patient',
        diagnosed: true,
        number_of_transfusion: 5,
        blood_group: 'A+',
        gender: 'Male',
        dob: toBs('2010-01-01'),
        diagnosed_date: toBs('2023-01-15')
      });

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 5));

      await Patient.create({
        registered_date: toBs('2023-02-01'),
        registered_no: 'PAT011',
        patient_name: 'Beta Patient',
        diagnosed: false,
        number_of_transfusion: 0,
        blood_group: 'B+',
        gender: 'Female',
        dob: toBs('2011-02-01'),
        diagnosed_date: toBs('2023-02-15')
      });

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 5));

      await Patient.create({
        registered_date: toBs('2023-03-01'),
        registered_no: 'PAT012',
        patient_name: 'Gamma Patient',
        diagnosed: true,
        number_of_transfusion: 3,
        blood_group: 'O+',
        gender: 'Male',
        dob: toBs('2012-03-01'),
        diagnosed_date: toBs('2023-03-15')
      });
    });

    it('should query patients by name', async () => {
      const patients = await Patient.find({ patient_name: 'Alpha Patient' });

      expect(patients).toHaveLength(1);
      expect(patients[0].registered_no).toBe('PAT010');
    });

    it('should query patients by blood group', async () => {
      const patients = await Patient.find({ blood_group: 'A+' });

      expect(patients).toHaveLength(1);
      expect(patients[0].patient_name).toBe('Alpha Patient');
    });

    it('should query patients by diagnosis status', async () => {
      const diagnosedPatients = await Patient.find({ diagnosed: true });
      const undiagnosedPatients = await Patient.find({ diagnosed: false });

      expect(diagnosedPatients).toHaveLength(2);
      expect(undiagnosedPatients).toHaveLength(1);
    });

    it('should query patients by date range', async () => {
      const startDate = toBs('2023-01-01');
      const endDate = toBs('2023-02-28');

      const patients = await Patient.find({
        registered_date: {
          $gte: startDate,
          $lte: endDate
        }
      }).sort({ registered_date: 1 });

      expect(patients).toHaveLength(2);
      expect(patients[0].registered_no).toBe('PAT010');
      expect(patients[1].registered_no).toBe('PAT011');
    });

    it('should sort patients by creation date descending', async () => {
      const patients = await Patient.find().sort({ created_at: -1 });

      expect(patients[0].registered_no).toBe('PAT012');
      expect(patients[1].registered_no).toBe('PAT011');
      expect(patients[2].registered_no).toBe('PAT010');
    });
  });

  describe('Edge Cases', () => {
    it('should handle patient with all optional fields', async () => {
      const fullPatientData = {
        registered_date: toBs('2024-01-01'),
        registered_no: 'PAT013',
        membership_type: 'Life',
        patient_name: 'Complete Patient',
        dob: toBs('2000-01-01'),
        gender: 'Female',
        blood_group: 'AB+',
        diagnosed: true,
        diagnosed_date: toBs('2024-01-15'),
        diagnosed_by: 'Dr. Smith',
        diagnosed_at: 'City Hospital',
        first_transfusion: toBs('2024-02-01'),
        number_of_transfusion: 10,
        complications: 'Liver issues',
        iron_chelation: 'Deferasirox',
        health_condition: 'Stable',
        other_medications: 'Vitamin supplements',
        bcg_opv_dpv_1st: toBs('2000-01-01'),
        measles_1st: toBs('2000-06-01'),
        hepatitis_1st: toBs('2000-03-01'),
        address_temporary: 'Temporary Address',
        mobile_temporary: '9876543210',
        address_permanent: 'Permanent Address',
        mobile_permanent: '9123456780',
        father_name: 'Parent One',
        father_birth_place: 'Example City',
        father_migration_history: 'Yes',
        father_occupation: 'Farmer',
        mother_name: 'Parent Two',
        mother_birth_place: 'Example Town',
        mother_migration_history: 'No',
        mother_occupation: 'Teacher',
        other_thalassemic_family: 'Sibling'
      };

      const patient = await Patient.create(fullPatientData);

      expect(patient._id).toBeDefined();
      expect(patient.registered_no).toBe('PAT013');
      expect(patient.membership_type).toBe('Life');
      expect(patient.diagnosed_by).toBe('Dr. Smith');
      expect(patient.complications).toBe('Liver issues');
      expect(patient.father_name).toBe('Parent One');
      expect(patient.mother_name).toBe('Parent Two');
      expect(patient.other_thalassemic_family).toBe('Sibling');
    });

    it('should handle patient with minimal fields', async () => {
      const minimalPatientData = {
        registered_date: toBs('2024-01-06'),
        registered_no: 'PAT014',
        patient_name: 'Minimal Patient'
      };

      const patient = await Patient.create(minimalPatientData);

      expect(patient._id).toBeDefined();
      expect(patient.registered_no).toBe('PAT014');
      expect(patient.patient_name).toBe('Minimal Patient');
      expect(patient.diagnosed).toBe(false);
      expect(patient.number_of_transfusion).toBe(0);
      expect(patient.gender).toBeUndefined();
      expect(patient.blood_group).toBeUndefined();
    });

    it('should handle multiple immunizations', async () => {
      const patientData = {
        registered_date: toBs('2024-01-07'),
        registered_no: 'PAT015',
        patient_name: 'Immunization Patient',
        diagnosed: false,
        number_of_transfusion: 0,
        bcg_opv_dpv_1st: toBs('2000-01-01'),
        bcg_opv_dpv_2nd: toBs('2000-02-01'),
        bcg_opv_dpv_3rd: toBs('2000-03-01'),
        measles_1st: toBs('2000-06-01'),
        measles_2nd: toBs('2000-07-01'),
        measles_3rd: toBs('2000-08-01'),
        hepatitis_1st: toBs('2000-03-01'),
        hepatitis_2nd: toBs('2000-04-01'),
        hepatitis_3rd: toBs('2000-05-01')
      };

      const patient = await Patient.create(patientData);

      expect(patient.bcg_opv_dpv_1st).toBeTypeOf('string');
      expect(patient.bcg_opv_dpv_2nd).toBeTypeOf('string');
      expect(patient.bcg_opv_dpv_3rd).toBeTypeOf('string');
      expect(patient.measles_1st).toBeTypeOf('string');
      expect(patient.measles_2nd).toBeTypeOf('string');
      expect(patient.measles_3rd).toBeTypeOf('string');
      expect(patient.hepatitis_1st).toBeTypeOf('string');
      expect(patient.hepatitis_2nd).toBeTypeOf('string');
      expect(patient.hepatitis_3rd).toBeTypeOf('string');
    });

    it('should update timestamps on save', async () => {
      const patientData = {
        registered_date: toBs('2024-01-08'),
        registered_no: 'PAT016',
        patient_name: 'Timestamp Patient',
        diagnosed: false,
        number_of_transfusion: 0
      };

      const patient = await Patient.create(patientData);
      const originalUpdatedAt = patient.updated_at;

      await new Promise(resolve => setTimeout(resolve, 100));

      patient.patient_name = 'Updated Name';
      await patient.save();

      expect(patient.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});
