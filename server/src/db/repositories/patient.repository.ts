import { Patient as PatientModel, IPatient } from '../../models/Patient.js';
import { CreatePatientDTO, UpdatePatientDTO } from '../types.js';

export class PatientRepository {

  async findAll(): Promise<IPatient[]> {
    return PatientModel.find().sort({ _id: 1 });
  }

  async findById(id: string): Promise<IPatient | null> {
    return PatientModel.findById(id);
  }

  async findByRegisteredNo(registeredNo: string): Promise<IPatient | null> {
    return PatientModel.findOne({ registered_no: registeredNo });
  }

  async create(data: CreatePatientDTO): Promise<IPatient> {
    if (!data.registered_date || !data.registered_no || !data.patient_name) {
      throw new Error('Registered date, registered number, and patient name are required');
    }

    const patient = new PatientModel({
      registered_date: new Date(data.registered_date),
      registered_no: data.registered_no,
      membership_type: data.membership_type,
      patient_name: data.patient_name,
      dob: data.dob ? new Date(data.dob) : undefined,
      gender: data.gender,
      blood_group: data.blood_group,
      diagnosed: data.diagnosed ?? false,
      diagnosed_date: data.diagnosed_date ? new Date(data.diagnosed_date) : undefined,
      diagnosed_by: data.diagnosed_by,
      diagnosed_at: data.diagnosed_at,
      first_transfusion: data.first_transfusion ? new Date(data.first_transfusion) : undefined,
      number_of_transfusion: data.number_of_transfusion ?? 0,
      complications: data.complications,
      iron_chelation: data.iron_chelation,
      health_condition: data.health_condition,
      other_medications: data.other_medications,
      bcg_opv_dpv_1st: data.bcg_opv_dpv_1st ? new Date(data.bcg_opv_dpv_1st) : undefined,
      bcg_opv_dpv_2nd: data.bcg_opv_dpv_2nd ? new Date(data.bcg_opv_dpv_2nd) : undefined,
      bcg_opv_dpv_3rd: data.bcg_opv_dpv_3rd ? new Date(data.bcg_opv_dpv_3rd) : undefined,
      measles_1st: data.measles_1st ? new Date(data.measles_1st) : undefined,
      measles_2nd: data.measles_2nd ? new Date(data.measles_2nd) : undefined,
      measles_3rd: data.measles_3rd ? new Date(data.measles_3rd) : undefined,
      hepatitis_1st: data.hepatitis_1st ? new Date(data.hepatitis_1st) : undefined,
      hepatitis_2nd: data.hepatitis_2nd ? new Date(data.hepatitis_2nd) : undefined,
      hepatitis_3rd: data.hepatitis_3rd ? new Date(data.hepatitis_3rd) : undefined,
      address_temporary: data.address_temporary,
      mobile_temporary: data.mobile_temporary,
      address_permanent: data.address_permanent,
      mobile_permanent: data.mobile_permanent,
      father_name: data.father_name,
      father_birth_place: data.father_birth_place,
      father_migration_history: data.father_migration_history,
      father_occupation: data.father_occupation,
      mother_name: data.mother_name,
      mother_birth_place: data.mother_birth_place,
      mother_migration_history: data.mother_migration_history,
      mother_occupation: data.mother_occupation,
      other_thalassemic_family: data.other_thalassemic_family,
    });

    return patient.save();
  }

  async update(id: string, data: UpdatePatientDTO): Promise<IPatient | null> {
    const updateData: any = {};

    // Convert date strings to Date objects where needed
    if (data.registered_date !== undefined) {
      updateData.registered_date = data.registered_date ? new Date(data.registered_date) : undefined;
    }
    if (data.dob !== undefined) {
      updateData.dob = data.dob ? new Date(data.dob) : undefined;
    }
    if (data.diagnosed_date !== undefined) {
      updateData.diagnosed_date = data.diagnosed_date ? new Date(data.diagnosed_date) : undefined;
    }
    if (data.first_transfusion !== undefined) {
      updateData.first_transfusion = data.first_transfusion ? new Date(data.first_transfusion) : undefined;
    }

    // Handle date arrays for immunizations
    const dateFields = [
      'bcg_opv_dpv_1st', 'bcg_opv_dpv_2nd', 'bcg_opv_dpv_3rd',
      'measles_1st', 'measles_2nd', 'measles_3rd',
      'hepatitis_1st', 'hepatitis_2nd', 'hepatitis_3rd'
    ];

    dateFields.forEach(field => {
      if (data[field as keyof UpdatePatientDTO] !== undefined) {
        const value = data[field as keyof UpdatePatientDTO];
        updateData[field] = value ? new Date(value as string) : undefined;
      }
    });

    // Copy other fields
    const otherFields = [
      'registered_no', 'membership_type', 'patient_name', 'gender', 'blood_group',
      'diagnosed', 'diagnosed_by', 'diagnosed_at', 'number_of_transfusion',
      'complications', 'iron_chelation', 'health_condition', 'other_medications',
      'address_temporary', 'mobile_temporary', 'address_permanent', 'mobile_permanent',
      'father_name', 'father_birth_place', 'father_migration_history', 'father_occupation',
      'mother_name', 'mother_birth_place', 'mother_migration_history', 'mother_occupation',
      'other_thalassemic_family'
    ];

    otherFields.forEach(field => {
      if (data[field as keyof UpdatePatientDTO] !== undefined) {
        updateData[field] = data[field as keyof UpdatePatientDTO];
      }
    });

    return PatientModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const result = await PatientModel.findByIdAndDelete(id);
    return result !== null;
  }
}

