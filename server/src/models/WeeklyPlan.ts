// models/WeeklyPlan.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
import { normalizeToBsDate } from '../utils/bsDate.js';

export enum WeeklyPlanStatus {
  DRAFT = 'draft',
  FINALIZED = 'finalized',
  SENT = 'sent'
}

export interface IWeeklyPlan extends Document {
  weekStart: string;
  weekEnd: string;
  status: WeeklyPlanStatus;
  createdBy: Types.ObjectId;
  finalizedAt?: Date;
  sentAt?: Date;
  created_at: Date;
  updated_at: Date;
}

const weeklyPlanSchema = new Schema<IWeeklyPlan>({
  weekStart: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  weekEnd: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: Object.values(WeeklyPlanStatus),
    default: WeeklyPlanStatus.DRAFT
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  finalizedAt: {
    type: Date
  },
  sentAt: {
    type: Date
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

const normalizePlanDates = (doc: Partial<IWeeklyPlan>) => {
  const dateFields: Array<keyof IWeeklyPlan> = ['weekStart', 'weekEnd'];
  dateFields.forEach((field) => {
    const value = doc[field] as string | Date | undefined;
    if (!value) return;
    doc[field] = normalizeToBsDate(value) as any;
  });
};

weeklyPlanSchema.pre('save', function(next) {
  normalizePlanDates(this);
  next();
});

weeklyPlanSchema.pre('insertMany', function(next, docs: Array<Partial<IWeeklyPlan>>) {
  docs.forEach((doc) => normalizePlanDates(doc));
  next();
});

export const WeeklyPlan = mongoose.model<IWeeklyPlan>('WeeklyPlan', weeklyPlanSchema);
