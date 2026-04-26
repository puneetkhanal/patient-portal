// models/Document.ts (Updated for GridFS)
import mongoose, { Schema, Document as MongooseDocument, Model, Types } from 'mongoose';

export enum DocumentType {
  PATIENT_PHOTO = 'patient_photo',
  CITIZENSHIP_PATIENT = 'citizenship_patient',
  CITIZENSHIP_FATHER = 'citizenship_father',
  CITIZENSHIP_MOTHER = 'citizenship_mother',
  DIAGNOSIS_REPORT = 'diagnosis_report',
  HOSPITAL_LETTER = 'hospital_letter',
  LAB_REPORT = 'lab_report',
  MEDICAL_RECORD = 'medical_record',
  OTHER = 'other'
}

export enum DocumentStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected'
}

export interface IDocument extends MongooseDocument {
  patientId: Types.ObjectId;
  documentType: DocumentType;
  fileName: string;
  storageType: 'filesystem' | 'gridfs';
  filePath?: string;
  gridFSFileId?: Types.ObjectId;
  fileSize: number;
  mimeType: string;
  uploadedBy: Types.ObjectId;
  status: DocumentStatus;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
  remarks?: string;
  issuingAuthority?: string;
  uploadDate: Date;
  metadata: Record<string, any>;
  isActive: boolean;
  verify(userId: Types.ObjectId, remarks?: string): Promise<IDocument>;
  reject(userId: Types.ObjectId, remarks: string): Promise<IDocument>;
}

export interface IDocumentModel extends Model<IDocument> {
  findByPatientId(patientId: Types.ObjectId | string): mongoose.Query<IDocument[], IDocument>;
  findByPatientIdAndType(patientId: Types.ObjectId | string, documentType: DocumentType): mongoose.Query<IDocument[], IDocument>;
  getDocumentStats(patientId?: Types.ObjectId | string): Promise<Array<Record<string, unknown>>>;
}

const documentSchema = new Schema<IDocument>({
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  documentType: {
    type: String,
    enum: Object.values(DocumentType),
    required: true,
    index: true
  },
  fileName: {
    type: String,
    required: true,
    trim: true
  },
  storageType: {
    type: String,
    enum: ['filesystem', 'gridfs'],
    default: 'gridfs'
  },
  filePath: {
    type: String
  },
  gridFSFileId: {
    type: Schema.Types.ObjectId,
    index: true
  },
  fileSize: {
    type: Number,
    required: true,
    min: 1
  },
  mimeType: {
    type: String,
    required: true
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: Object.values(DocumentStatus),
    default: DocumentStatus.PENDING,
    index: true
  },
  verifiedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: {
    type: Date
  },
  remarks: {
    type: String,
    trim: true
  },
  issuingAuthority: {
    type: String,
    trim: true
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

documentSchema.index({ patientId: 1, documentType: 1, isActive: 1 });
documentSchema.index({ patientId: 1, status: 1 });
documentSchema.index({ uploadedBy: 1, uploadDate: -1 });

documentSchema.virtual('patient', {
  ref: 'Patient',
  localField: 'patientId',
  foreignField: '_id',
  justOne: true
});

documentSchema.virtual('uploader', {
  ref: 'User',
  localField: 'uploadedBy',
  foreignField: '_id',
  justOne: true
});

documentSchema.virtual('verifier', {
  ref: 'User',
  localField: 'verifiedBy',
  foreignField: '_id',
  justOne: true
});

documentSchema.methods.verify = function(userId: Types.ObjectId, remarks?: string) {
  this.status = DocumentStatus.VERIFIED;
  this.verifiedBy = userId;
  this.verifiedAt = new Date();
  if (remarks) this.remarks = remarks;
  return this.save();
};

documentSchema.methods.reject = function(userId: Types.ObjectId, remarks: string) {
  this.status = DocumentStatus.REJECTED;
  this.verifiedBy = userId;
  this.verifiedAt = new Date();
  this.remarks = remarks;
  return this.save();
};

documentSchema.statics.findByPatientId = function(patientId: Types.ObjectId | string) {
  return this.find({ patientId, isActive: true })
    .populate('uploader', 'name email')
    .populate('verifier', 'name email')
    .sort({ uploadDate: -1 });
};

documentSchema.statics.findByPatientIdAndType = function(
  patientId: Types.ObjectId | string,
  documentType: DocumentType
) {
  return this.find({ patientId, documentType, isActive: true })
    .sort({ uploadDate: -1 });
};

documentSchema.statics.getDocumentStats = async function(patientId?: Types.ObjectId | string) {
  const matchStage: any = { isActive: true };
  if (patientId) {
    matchStage.patientId = new mongoose.Types.ObjectId(patientId.toString());
  }

  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$documentType',
        count: { $sum: 1 },
        totalSize: { $sum: '$fileSize' },
        verified: {
          $sum: { $cond: [{ $eq: ['$status', 'verified'] }, 1, 0] }
        },
        pending: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        }
      }
    },
    { $sort: { count: -1 } }
  ]);

  return stats;
};

documentSchema.pre('save', function(next) {
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  
  if (this.fileSize > MAX_FILE_SIZE) {
    const error = new Error(`File size exceeds limit. Max allowed: 50MB`);
    next(error);
    return;
  }
  
  next();
});

export const Document = mongoose.model<IDocument, IDocumentModel>('Document', documentSchema);
