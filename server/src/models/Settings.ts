// models/Settings.ts
import mongoose, { Schema, Document } from 'mongoose';

export interface IEmailRecipient {
  name: string;
  email: string;
  active: boolean;
}

export interface IHospitalCapacity {
  name: string;
  slots: Record<string, number>;
}

export interface ISettings extends Document {
  weekStartDay: string;
  weekTimeZone: string;
  calendarMode: 'AD' | 'BS';
  allowBackEntry: boolean;
  backEntryWarningDays: number;
  hospitalList: string[];
  hospitalCapacities: IHospitalCapacity[];
  bloodGroups: string[];
  emailRecipients: IEmailRecipient[];
  created_at: Date;
  updated_at: Date;
}

const settingsSchema = new Schema<ISettings>({
  weekStartDay: {
    type: String,
    enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    default: 'Sunday',
    required: true
  },
  weekTimeZone: {
    type: String,
    default: 'Asia/Kathmandu',
    required: true
  },
  calendarMode: {
    type: String,
    enum: ['AD', 'BS'],
    default: 'BS',
    required: true
  },
  allowBackEntry: {
    type: Boolean,
    default: true
  },
  backEntryWarningDays: {
    type: Number,
    default: 7,
    min: 0
  },
  hospitalList: {
    type: [String],
    default: ['General Hospital', 'Community Hospital']
  },
  hospitalCapacities: {
    type: [
      {
        name: { type: String, required: true },
        slots: {
          Sunday: { type: Number, default: 0 },
          Monday: { type: Number, default: 0 },
          Tuesday: { type: Number, default: 0 },
          Wednesday: { type: Number, default: 0 },
          Thursday: { type: Number, default: 0 },
          Friday: { type: Number, default: 0 },
          Saturday: { type: Number, default: 0 }
        }
      }
    ],
    default: []
  },
  bloodGroups: {
    type: [String],
    default: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
  },
  emailRecipients: {
    type: [
      {
        name: { type: String, required: true },
        email: { type: String, required: true },
        active: { type: Boolean, default: true }
      }
    ],
    default: []
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

settingsSchema.index({ updated_at: -1 });

export const Settings = mongoose.model<ISettings>('Settings', settingsSchema);
