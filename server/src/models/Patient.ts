// models/Patient.ts
import mongoose, { Schema, Document as MongooseDocument, Model, Types } from 'mongoose';
import { Document as PatientDocument, DocumentType } from './Document.js';
import { Document } from './Document.js';
import { normalizeToBsDate } from '../utils/bsDate.js';

export interface IPatient extends MongooseDocument {
  registered_date: string;
  registered_no: string;
  registered_no_lower?: string;
  membership_type?: string;
  patient_name: string;
  patient_name_lower?: string;
  dob?: string;
  gender?: string;
  blood_group?: string;
  diagnosed: boolean;
  diagnosed_date?: string;
  diagnosed_by?: string;
  diagnosed_at?: string;
  first_transfusion?: string;
  number_of_transfusion: number;
  complications?: string;
  iron_chelation?: string;
  health_condition?: string;
  other_medications?: string;
  bcg_opv_dpv_1st?: string;
  bcg_opv_dpv_2nd?: string;
  bcg_opv_dpv_3rd?: string;
  measles_1st?: string;
  measles_2nd?: string;
  measles_3rd?: string;
  hepatitis_1st?: string;
  hepatitis_2nd?: string;
  hepatitis_3rd?: string;
  address_temporary?: string;
  mobile_temporary?: string;
  address_permanent?: string;
  mobile_permanent?: string;
  isActive: boolean;
  father_name?: string;
  father_birth_place?: string;
  father_migration_history?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_birth_place?: string;
  mother_migration_history?: string;
  mother_occupation?: string;
  other_thalassemic_family?: string;
  created_at: Date;
  updated_at: Date;

  // Virtual fields for documents
  readonly documents?: any[];
  readonly patientPhoto?: any;
  readonly diagnosisReport?: any;
  readonly citizenshipDocuments?: any[];
}

export interface IPatientModel extends Model<IPatient> {
  findByIdWithDocuments(
    patientId: Types.ObjectId | string,
    options?: {
      includeInactive?: boolean;
      documentTypes?: DocumentType[];
      populateUploader?: boolean;
    }
  ): Promise<(Record<string, unknown> & { documents: unknown[] }) | null>;
  getDocumentStats(patientId: Types.ObjectId | string): Promise<Array<Record<string, unknown>>>;
}

const patientSchema = new Schema<IPatient>({
  registered_date: {
    type: String,
    required: true
  },
  registered_no: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  registered_no_lower: {
    type: String,
    trim: true,
    index: true
  },
  membership_type: {
    type: String,
    trim: true
  },
  patient_name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  patient_name_lower: {
    type: String,
    trim: true,
    index: true
  },
  dob: {
    type: String
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other']
  },
  blood_group: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  diagnosed: {
    type: Boolean,
    default: false,
    index: true
  },
  diagnosed_date: {
    type: String
  },
  diagnosed_by: {
    type: String,
    trim: true
  },
  diagnosed_at: {
    type: String,
    trim: true
  },
  first_transfusion: {
    type: String
  },
  number_of_transfusion: {
    type: Number,
    default: 0,
    min: 0
  },
  complications: {
    type: String
  },
  iron_chelation: {
    type: String
  },
  health_condition: {
    type: String
  },
  other_medications: {
    type: String
  },
  // Immunization dates
  bcg_opv_dpv_1st: { type: String },
  bcg_opv_dpv_2nd: { type: String },
  bcg_opv_dpv_3rd: { type: String },
  measles_1st: { type: String },
  measles_2nd: { type: String },
  measles_3rd: { type: String },
  hepatitis_1st: { type: String },
  hepatitis_2nd: { type: String },
  hepatitis_3rd: { type: String },
  // Address information
  address_temporary: { type: String },
  mobile_temporary: { type: String },
  address_permanent: { type: String },
  mobile_permanent: { type: String },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  // Family information
  father_name: { type: String },
  father_birth_place: { type: String },
  father_migration_history: { type: String },
  father_occupation: { type: String },
  mother_name: { type: String },
  mother_birth_place: { type: String },
  mother_migration_history: { type: String },
  mother_occupation: { type: String },
  other_thalassemic_family: { type: String }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for all documents
patientSchema.virtual('documents', {
  ref: 'Document',
  localField: '_id',
  foreignField: 'patientId',
  match: { isActive: true }
});

// Virtual for patient photo (most recent)
patientSchema.virtual('patientPhoto', {
  ref: 'Document',
  localField: '_id',
  foreignField: 'patientId',
  match: {
    documentType: DocumentType.PATIENT_PHOTO,
    isActive: true,
    status: { $in: ['pending', 'verified'] }
  },
  justOne: true,
  options: { sort: { uploadDate: -1 } }
});

// Virtual for diagnosis report (most recent)
patientSchema.virtual('diagnosisReport', {
  ref: 'Document',
  localField: '_id',
  foreignField: 'patientId',
  match: {
    documentType: DocumentType.DIAGNOSIS_REPORT,
    isActive: true,
    status: { $in: ['pending', 'verified'] }
  },
  justOne: true,
  options: { sort: { uploadDate: -1 } }
});

// Virtual for citizenship documents
patientSchema.virtual('citizenshipDocuments', {
  ref: 'Document',
  localField: '_id',
  foreignField: 'patientId',
  match: {
    documentType: {
      $in: [
        DocumentType.CITIZENSHIP_PATIENT,
        DocumentType.CITIZENSHIP_FATHER,
        DocumentType.CITIZENSHIP_MOTHER
      ]
    },
    isActive: true,
    status: { $in: ['pending', 'verified'] }
  },
  options: { sort: { uploadDate: -1 } }
});

type PatientDateField =
  | 'registered_date'
  | 'dob'
  | 'diagnosed_date'
  | 'first_transfusion'
  | 'bcg_opv_dpv_1st'
  | 'bcg_opv_dpv_2nd'
  | 'bcg_opv_dpv_3rd'
  | 'measles_1st'
  | 'measles_2nd'
  | 'measles_3rd'
  | 'hepatitis_1st'
  | 'hepatitis_2nd'
  | 'hepatitis_3rd';

type NormalizablePatientFields = Partial<Pick<IPatient, 'registered_no' | 'patient_name' | 'registered_no_lower' | 'patient_name_lower'>> &
  Partial<Record<PatientDateField, string | Date>>;

const normalizePatientFields = (doc: NormalizablePatientFields) => {
  if (doc.registered_no) {
    doc.registered_no_lower = doc.registered_no.toLowerCase();
  }
  if (doc.patient_name) {
    doc.patient_name_lower = doc.patient_name.toLowerCase();
  }
  const dateFields: PatientDateField[] = [
    'registered_date',
    'dob',
    'diagnosed_date',
    'first_transfusion',
    'bcg_opv_dpv_1st',
    'bcg_opv_dpv_2nd',
    'bcg_opv_dpv_3rd',
    'measles_1st',
    'measles_2nd',
    'measles_3rd',
    'hepatitis_1st',
    'hepatitis_2nd',
    'hepatitis_3rd'
  ];
  dateFields.forEach((field) => {
    const value = doc[field];
    if (!value) return;
    doc[field] = normalizeToBsDate(value);
  });
};

patientSchema.pre('save', function(next) {
  normalizePatientFields(this);
  next();
});

patientSchema.pre('insertMany', function(next, docs: NormalizablePatientFields[]) {
  docs.forEach((doc) => normalizePatientFields(doc));
  next();
});

// Static method to get patient with documents
patientSchema.statics.findByIdWithDocuments = async function(
  patientId: Types.ObjectId | string,
  options: {
    includeInactive?: boolean;
    documentTypes?: DocumentType[];
    populateUploader?: boolean;
  } = {}
) {
  const query: any = { patientId: new mongoose.Types.ObjectId(patientId.toString()) };

  if (!options.includeInactive) {
    query.isActive = true;
  }

  if (options.documentTypes && options.documentTypes.length > 0) {
    query.documentType = { $in: options.documentTypes };
  }

  const patient = await this.findById(patientId);
  if (!patient) return null;

  let documentQuery = PatientDocument.find(query).sort({ uploadDate: -1 });

  if (options.populateUploader) {
    documentQuery = documentQuery.populate('uploader', 'name email role');
  }

  const documents = await documentQuery;

  const patientObj = patient.toObject();
  patientObj.documents = documents;

  return patientObj;
};

// Static method to get patient's document statistics
patientSchema.statics.getDocumentStats = async function(patientId: Types.ObjectId | string) {
  return Document.getDocumentStats(patientId);
};

// Instance method to add document
patientSchema.methods.addDocument = async function(
  documentData: {
    documentType: DocumentType;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    uploadedBy: Types.ObjectId;
    metadata?: Record<string, any>;
    issuingAuthority?: string;
  }
) {
  const document = new PatientDocument({
    ...documentData,
    patientId: this._id
  });

  return await document.save();
};

// Instance method to get required documents status
patientSchema.methods.getRequiredDocumentsStatus = async function() {
  const requiredDocs = [
    DocumentType.DIAGNOSIS_REPORT,
    DocumentType.CITIZENSHIP_PATIENT
  ];

  const documents = await PatientDocument.find({
    patientId: this._id,
    documentType: { $in: requiredDocs },
    isActive: true,
    status: { $in: ['verified'] }
  });

  const status: Record<string, boolean> = {};
  requiredDocs.forEach(docType => {
    status[docType] = documents.some(doc => doc.documentType === docType);
  });

  return {
    isComplete: requiredDocs.every(docType => status[docType]),
    details: status
  };
};

// Pre-remove middleware (if you want to soft-delete related documents)
patientSchema.pre('findOneAndDelete', async function(next) {
  const patientId = this.getQuery()._id;

  if (patientId) {
    // Soft delete related documents instead of hard delete
    await PatientDocument.updateMany(
      { patientId },
      { $set: { isActive: false } }
    );
  }

  next();
});

// Indexes
patientSchema.index({ patient_name: 1, dob: 1 });
patientSchema.index({ blood_group: 1 });
patientSchema.index({ diagnosed_date: 1 });
patientSchema.index({ created_at: -1 });

export const Patient = mongoose.model<IPatient, IPatientModel>('Patient', patientSchema);
