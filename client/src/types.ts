export interface HealthStatus {
  status: string;
  message: string;
}

export interface Patient {
  id?: string;
  _id?: string;
  registered_date: string;
  registered_no: string;
  membership_type: string | null;
  patient_name: string;
  dob: string | null;
  gender: string | null;
  blood_group: string | null;
  diagnosed: boolean;
  diagnosed_date: string | null;
  diagnosed_by: string | null;
  diagnosed_at: string | null;
  first_transfusion: string | null;
  number_of_transfusion: number;
  complications: string | null;
  iron_chelation: string | null;
  health_condition: string | null;
  other_medications: string | null;
  bcg_opv_dpv_1st: string | null;
  bcg_opv_dpv_2nd: string | null;
  bcg_opv_dpv_3rd: string | null;
  measles_1st: string | null;
  measles_2nd: string | null;
  measles_3rd: string | null;
  hepatitis_1st: string | null;
  hepatitis_2nd: string | null;
  hepatitis_3rd: string | null;
  address_temporary: string | null;
  mobile_temporary: string | null;
  address_permanent: string | null;
  mobile_permanent: string | null;
  father_name: string | null;
  father_birth_place: string | null;
  father_migration_history: string | null;
  father_occupation: string | null;
  mother_name: string | null;
  mother_birth_place: string | null;
  mother_migration_history: string | null;
  mother_occupation: string | null;
  other_thalassemic_family: string | null;
  created_at: string;
  updated_at: string;
}

export interface Settings {
  _id?: string;
  weekStartDay: string;
  weekTimeZone: string;
  calendarMode?: 'AD' | 'BS';
  allowBackEntry: boolean;
  backEntryWarningDays: number;
  hospitalList: string[];
  hospitalCapacities: Array<{ name: string; slots: Record<string, number> }>;
  bloodGroups: string[];
  emailRecipients: Array<{ name: string; email: string; active: boolean }>;
}

export interface WeeklyRequest {
  _id: string;
  patientId: string;
  weekStart: string;
  weekEnd: string;
  callDate: string;
  requestedUnits: 1 | 2;
  requestedHospital: string;
  preferredDay?: string;
  preferredDate?: string;
  remarks?: string;
  status: string;
  warningBackEntry: boolean;
  created_at: string;
  updated_at: string;
}

export interface WeeklyPlan {
  _id: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  createdBy: string;
  finalizedAt?: string | null;
  sentAt?: string | null;
}

export interface WeeklyPlanItem {
  _id: string;
  planId: string;
  requestId: string;
  patientId: string;
  assignedHospital: string;
  assignedDate: string;
  assignedUnits: number;
  notes?: string;
  status: string;
}

export interface TransfusionRecord {
  _id: string;
  planItemId: string;
  patientId: string;
  scheduledDate: string;
  actualDate: string;
  unitsTransfused: number;
  outcome: string;
  reason?: string;
  notes?: string;
  createdBy: string;
  created_at: string;
  updated_at: string;
}

export interface WeeklySummary {
  totalUnits: number;
  byBloodGroup: Record<string, number>;
  byHospital: Record<string, number>;
  byDate: Record<string, number>;
}

export interface ReportFrequencyRow {
  patientId: string;
  totalTransfusions: number;
  totalUnits: number;
  lastTransfusionDate: string | null;
  averageIntervalDays: number | null;
  frequencyCategory: string;
  patient_name?: string;
  registered_no?: string;
}

export interface ReportShortageRow {
  weekStart: string;
  requestedUnits: number;
  transfusedUnits: number;
  shortageUnits: number;
}

export interface ReportHospitalRow {
  hospital: string;
  totalUnits: number;
  transfusionCount: number;
}

export interface ReportPeakDayRow {
  date: string;
  totalUnits: number;
}
