export interface User {
  id: string;
  email: string;
  name: string;
  password_hash?: string; // Only included when needed, never in API responses
  created_at: Date;
}

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  created_at: Date;
}

export interface CreateUserDTO {
  email: string;
  name: string;
  password?: string; // For registration
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: UserPublic;
}

export interface Patient {
  id: string;
  registered_date: Date;
  registered_no: string;
  membership_type: string | null;
  patient_name: string;
  dob: Date | null;
  gender: string | null;
  blood_group: string | null;
  diagnosed: boolean;
  diagnosed_date: Date | null;
  diagnosed_by: string | null;
  diagnosed_at: string | null;
  first_transfusion: Date | null;
  number_of_transfusion: number;
  complications: string | null;
  iron_chelation: string | null;
  health_condition: string | null;
  other_medications: string | null;
  bcg_opv_dpv_1st: Date | null;
  bcg_opv_dpv_2nd: Date | null;
  bcg_opv_dpv_3rd: Date | null;
  measles_1st: Date | null;
  measles_2nd: Date | null;
  measles_3rd: Date | null;
  hepatitis_1st: Date | null;
  hepatitis_2nd: Date | null;
  hepatitis_3rd: Date | null;
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
  created_at: Date;
  updated_at: Date;
}

export interface CreatePatientDTO {
  registered_date: string;
  registered_no: string;
  membership_type?: string;
  patient_name: string;
  dob?: string;
  gender?: string;
  blood_group?: string;
  diagnosed?: boolean;
  diagnosed_date?: string;
  diagnosed_by?: string;
  diagnosed_at?: string;
  first_transfusion?: string;
  number_of_transfusion?: number;
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
  father_name?: string;
  father_birth_place?: string;
  father_migration_history?: string;
  father_occupation?: string;
  mother_name?: string;
  mother_birth_place?: string;
  mother_migration_history?: string;
  mother_occupation?: string;
  other_thalassemic_family?: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface UpdatePatientDTO extends Partial<CreatePatientDTO> {}

