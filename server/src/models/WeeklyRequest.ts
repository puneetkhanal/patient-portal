// models/WeeklyRequest.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
import { normalizeToBsDate } from '../utils/bsDate.js';

export enum WeeklyRequestStatus {
  PENDING = 'pending',
  PLANNED = 'planned',
  CANCELLED = 'cancelled'
}

export interface IWeeklyRequest extends Document {
  patientId: Types.ObjectId;
  weekStart: string;
  weekEnd: string;
  callDate: string;
  requestedUnits: 1 | 2;
  requestedHospital: string;
  preferredDay?: string;
  preferredDate?: string;
  remarks?: string;
  status: WeeklyRequestStatus;
  warningBackEntry: boolean;
  createdBy: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const weeklyRequestSchema = new Schema<IWeeklyRequest>({
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  weekStart: {
    type: String,
    required: true,
    index: true
  },
  weekEnd: {
    type: String,
    required: true
  },
  callDate: {
    type: String,
    required: true
  },
  requestedUnits: {
    type: Number,
    enum: [1, 2],
    required: true
  },
  requestedHospital: {
    type: String,
    required: true,
    trim: true
  },
  preferredDay: {
    type: String,
    trim: true
  },
  preferredDate: {
    type: String
  },
  remarks: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: Object.values(WeeklyRequestStatus),
    default: WeeklyRequestStatus.PENDING
  },
  warningBackEntry: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const normalizeRequestDates = (doc: Partial<IWeeklyRequest>) => {
  const dateFields: Array<keyof IWeeklyRequest> = ['weekStart', 'weekEnd', 'callDate', 'preferredDate'];
  dateFields.forEach((field) => {
    const value = doc[field] as string | Date | undefined;
    if (!value) return;
    doc[field] = normalizeToBsDate(value) as any;
  });
};

weeklyRequestSchema.pre('save', function(next) {
  normalizeRequestDates(this);
  next();
});

weeklyRequestSchema.pre('insertMany', function(next, docs: Array<Partial<IWeeklyRequest>>) {
  docs.forEach((doc) => normalizeRequestDates(doc));
  next();
});

weeklyRequestSchema.index({ patientId: 1, weekStart: 1 }, { unique: true });

export const WeeklyRequest = mongoose.model<IWeeklyRequest>('WeeklyRequest', weeklyRequestSchema);
