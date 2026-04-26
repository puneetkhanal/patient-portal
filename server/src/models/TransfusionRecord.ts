// models/TransfusionRecord.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
import { normalizeToBsDate } from '../utils/bsDate.js';

export enum TransfusionOutcome {
  COMPLETED = 'completed',
  POSTPONED = 'postponed',
  CANCELLED = 'cancelled'
}

export interface ITransfusionRecord extends Document {
  planItemId: Types.ObjectId;
  patientId: Types.ObjectId;
  scheduledDate: string;
  actualDate?: string;
  unitsTransfused: number;
  outcome: TransfusionOutcome;
  reason?: string;
  notes?: string;
  createdBy: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const transfusionRecordSchema = new Schema<ITransfusionRecord>({
  planItemId: {
    type: Schema.Types.ObjectId,
    ref: 'WeeklyPlanItem',
    required: true,
    index: true
  },
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  scheduledDate: {
    type: String,
    required: true
  },
  actualDate: {
    type: String
  },
  unitsTransfused: {
    type: Number,
    min: 0,
    required: true
  },
  outcome: {
    type: String,
    enum: Object.values(TransfusionOutcome),
    required: true
  },
  reason: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

transfusionRecordSchema.pre('save', function(next) {
  if (this.scheduledDate) {
    this.scheduledDate = normalizeToBsDate(this.scheduledDate) as any;
  }
  if (this.actualDate) {
    this.actualDate = normalizeToBsDate(this.actualDate) as any;
  }
  next();
});

transfusionRecordSchema.pre('insertMany', function(next, docs: Array<Partial<ITransfusionRecord>>) {
  docs.forEach((doc) => {
    if (doc.scheduledDate) {
      doc.scheduledDate = normalizeToBsDate(doc.scheduledDate) as any;
    }
    if (doc.actualDate) {
      doc.actualDate = normalizeToBsDate(doc.actualDate) as any;
    }
  });
  next();
});

transfusionRecordSchema.index({ patientId: 1, scheduledDate: -1 });

export const TransfusionRecord = mongoose.model<ITransfusionRecord>('TransfusionRecord', transfusionRecordSchema);
