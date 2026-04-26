// models/WeeklyPlanItem.ts
import mongoose, { Schema, Document, Types } from 'mongoose';
import { normalizeToBsDate } from '../utils/bsDate.js';

export enum WeeklyPlanItemStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  POSTPONED = 'postponed',
  CANCELLED = 'cancelled'
}

export interface IWeeklyPlanItem extends Document {
  planId: Types.ObjectId;
  requestId: Types.ObjectId;
  patientId: Types.ObjectId;
  assignedHospital: string;
  assignedDate: string;
  assignedUnits: 1 | 2;
  notes?: string;
  status: WeeklyPlanItemStatus;
  created_at: Date;
  updated_at: Date;
}

const weeklyPlanItemSchema = new Schema<IWeeklyPlanItem>({
  planId: {
    type: Schema.Types.ObjectId,
    ref: 'WeeklyPlan',
    required: true,
    index: true
  },
  requestId: {
    type: Schema.Types.ObjectId,
    ref: 'WeeklyRequest',
    required: true,
    index: true
  },
  patientId: {
    type: Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
    index: true
  },
  assignedHospital: {
    type: String,
    required: true,
    trim: true
  },
  assignedDate: {
    type: String,
    required: true,
    index: true
  },
  assignedUnits: {
    type: Number,
    enum: [1, 2],
    required: true
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: Object.values(WeeklyPlanItemStatus),
    default: WeeklyPlanItemStatus.SCHEDULED
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

weeklyPlanItemSchema.pre('save', function(next) {
  if (this.assignedDate) {
    this.assignedDate = normalizeToBsDate(this.assignedDate) as any;
  }
  next();
});

weeklyPlanItemSchema.pre('insertMany', function(next, docs: Array<Partial<IWeeklyPlanItem>>) {
  docs.forEach((doc) => {
    if (doc.assignedDate) {
      doc.assignedDate = normalizeToBsDate(doc.assignedDate) as any;
    }
  });
  next();
});

weeklyPlanItemSchema.index({ planId: 1, patientId: 1 });

export const WeeklyPlanItem = mongoose.model<IWeeklyPlanItem>('WeeklyPlanItem', weeklyPlanItemSchema);
