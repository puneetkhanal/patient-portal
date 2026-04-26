import { useState, type ChangeEvent, type FormEvent } from 'react';

import { Patient } from '../types';
import { useAuth, getAuthHeaders } from '../contexts/AuthContext';
import { getTodayBs } from '../utils/nepaliDate';

import { DateInput } from './DateInput';
import './PatientRegistrationForm.css';

interface DocumentUpload {
  id: string;
  documentType: string;
  issuingAuthority: string;
  file: File | null;
}

interface PatientRegistrationFormProps {
  patient?: Patient | null;
  onCancel: () => void;
  onSuccess: () => void;
}

export function PatientRegistrationForm({ patient, onCancel, onSuccess }: PatientRegistrationFormProps) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState<DocumentUpload[]>([
    { id: `${Date.now()}-0`, documentType: '', issuingAuthority: '', file: null }
  ]);

  // Form state
  const [formData, setFormData] = useState({
    registered_date: patient?.registered_date ? patient.registered_date.split('T')[0] : getTodayBs(),
    registered_no: patient?.registered_no || '',
    membership_type: patient?.membership_type || '',
    patient_name: patient?.patient_name || '',
    dob: patient?.dob ? patient.dob.split('T')[0] : '',
    gender: patient?.gender || '',
    blood_group: patient?.blood_group || '',
    diagnosed: patient?.diagnosed || false,
    diagnosed_date: patient?.diagnosed_date ? patient.diagnosed_date.split('T')[0] : '',
    diagnosed_by: patient?.diagnosed_by || '',
    diagnosed_at: patient?.diagnosed_at || '',
    first_transfusion: patient?.first_transfusion ? patient.first_transfusion.split('T')[0] : '',
    number_of_transfusion: patient?.number_of_transfusion || 0,
    complications: patient?.complications || '',
    iron_chelation: patient?.iron_chelation || '',
    health_condition: patient?.health_condition || '',
    other_medications: patient?.other_medications || '',
    bcg_opv_dpv_1st: patient?.bcg_opv_dpv_1st ? patient.bcg_opv_dpv_1st.split('T')[0] : '',
    bcg_opv_dpv_2nd: patient?.bcg_opv_dpv_2nd ? patient.bcg_opv_dpv_2nd.split('T')[0] : '',
    bcg_opv_dpv_3rd: patient?.bcg_opv_dpv_3rd ? patient.bcg_opv_dpv_3rd.split('T')[0] : '',
    measles_1st: patient?.measles_1st ? patient.measles_1st.split('T')[0] : '',
    measles_2nd: patient?.measles_2nd ? patient.measles_2nd.split('T')[0] : '',
    measles_3rd: patient?.measles_3rd ? patient.measles_3rd.split('T')[0] : '',
    hepatitis_1st: patient?.hepatitis_1st ? patient.hepatitis_1st.split('T')[0] : '',
    hepatitis_2nd: patient?.hepatitis_2nd ? patient.hepatitis_2nd.split('T')[0] : '',
    hepatitis_3rd: patient?.hepatitis_3rd ? patient.hepatitis_3rd.split('T')[0] : '',
    address_temporary: patient?.address_temporary || '',
    mobile_temporary: patient?.mobile_temporary || '',
    address_permanent: patient?.address_permanent || '',
    mobile_permanent: patient?.mobile_permanent || '',
    father_name: patient?.father_name || '',
    father_birth_place: patient?.father_birth_place || '',
    father_migration_history: patient?.father_migration_history || '',
    father_occupation: patient?.father_occupation || '',
    mother_name: patient?.mother_name || '',
    mother_birth_place: patient?.mother_birth_place || '',
    mother_migration_history: patient?.mother_migration_history || '',
    mother_occupation: patient?.mother_occupation || '',
    other_thalassemic_family: patient?.other_thalassemic_family || '',
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleDateChange = (name: keyof typeof formData, value: string) => {
    setFormData((prev) => {
      if (name === 'registered_date' && !value && prev.registered_date) {
        return prev;
      }
      return {
        ...prev,
        [name]: value
      };
    });
  };

  const addDocumentRow = () => {
    setDocuments((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length}`, documentType: '', issuingAuthority: '', file: null }
    ]);
  };

  const removeDocumentRow = (id: string) => {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  };

  const handleDocumentChange = (
    id: string,
    field: 'documentType' | 'issuingAuthority',
    value: string
  ) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, [field]: value } : doc))
    );
  };

  const handleFileChange = (id: string, file: File | null) => {
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? { ...doc, file } : doc))
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const patientId = patient?.id || patient?._id;
      const url = patientId ? `/api/patients/${patientId}` : '/api/patients';
      const method = patient ? 'PUT' : 'POST';

      const payload = { ...formData };
      if (typeof document !== 'undefined') {
        const registeredDateInput = document.getElementById('registered_date') as HTMLInputElement | null;
        if (registeredDateInput?.value) {
          payload.registered_date = registeredDateInput.value;
        }
        const registeredNoInput = document.getElementById('registered_no') as HTMLInputElement | null;
        if (registeredNoInput?.value) {
          payload.registered_no = registeredNoInput.value;
        }
        const patientNameInput = document.getElementById('patient_name') as HTMLInputElement | null;
        if (patientNameInput?.value) {
          payload.patient_name = patientNameInput.value;
        }
      }

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(token),
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || responseData.message || 'Failed to save patient');
      }

      const savedPatientId = responseData?.data?.patient?._id || patientId;
      const resolvedDocuments = documents.map((doc) => {
        if (typeof document === 'undefined') return doc;
        let documentType = doc.documentType;
        let issuingAuthority = doc.issuingAuthority;
        let file = doc.file;

        if (!documentType) {
          const select = document.getElementById(`document_type_${doc.id}`) as HTMLSelectElement | null;
          if (select?.value) {
            documentType = select.value;
          }
        }

        if (!file) {
          const input = document.getElementById(`document_file_${doc.id}`) as HTMLInputElement | null;
          if (input?.files?.[0]) {
            file = input.files[0];
          }
        }

        if (!issuingAuthority) {
          const input = document.getElementById(`document_issuing_${doc.id}`) as HTMLInputElement | null;
          if (input?.value) {
            issuingAuthority = input.value;
          }
        }

        return { ...doc, documentType, issuingAuthority, file };
      });
      const uploads = resolvedDocuments.filter((doc) => doc.file && doc.documentType);

      if (uploads.length > 0) {
        if (!savedPatientId) {
          throw new Error('Patient saved but documents could not be uploaded.');
        }

        for (const doc of uploads) {
          const form = new FormData();
          form.append('file', doc.file as File);
          form.append('documentType', doc.documentType);
          if (doc.issuingAuthority.trim()) {
            form.append('issuingAuthority', doc.issuingAuthority.trim());
          }

          const uploadResponse = await fetch(
            `/api/patients/${savedPatientId}/documents`,
            {
              method: 'POST',
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              body: form
            }
          );

          if (!uploadResponse.ok) {
            const uploadError = await uploadResponse.json().catch(() => ({}));
            throw new Error(uploadError.message || 'Failed to upload documents');
          }
        }
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="patient-form-container">
      <div className="patient-form-header">
        <h1>{patient ? 'Edit Patient' : 'Register New Patient'}</h1>
        <button className="btn-cancel" onClick={onCancel} disabled={loading}>
          ← Back to List
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="patient-form">
        {/* Registration Information */}
        <section className="form-section">
          <h2>Registration Information</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="registered_date">Registered Date *</label>
              <DateInput
                id="registered_date"
                name="registered_date"
                value={formData.registered_date}
                required
                disabled={loading}
                onChange={(value) => handleDateChange('registered_date', value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="registered_no">Registered No *</label>
              <input
                type="text"
                id="registered_no"
                name="registered_no"
                value={formData.registered_no}
                onChange={handleChange}
                required
                disabled={loading || !!patient}
                placeholder="REG001"
              />
            </div>
            <div className="form-group">
              <label htmlFor="membership_type">Membership Type</label>
              <input
                type="text"
                id="membership_type"
                name="membership_type"
                value={formData.membership_type}
                onChange={handleChange}
                disabled={loading}
                placeholder="Premium, Standard, etc."
              />
            </div>
          </div>
        </section>

        {/* Patient Details */}
        <section className="form-section">
          <h2>Patient Details</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="patient_name">Patient's Name *</label>
              <input
                type="text"
                id="patient_name"
                name="patient_name"
                value={formData.patient_name}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="dob">Date of Birth</label>
              <DateInput
                id="dob"
                name="dob"
                value={formData.dob}
                disabled={loading}
                onChange={(value) => handleDateChange('dob', value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="gender">Gender</label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="blood_group">Blood Group</label>
              <select
                id="blood_group"
                name="blood_group"
                value={formData.blood_group}
                onChange={handleChange}
                disabled={loading}
              >
                <option value="">Select Blood Group</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
          </div>
        </section>

        {/* Diagnosis Information */}
        <section className="form-section">
          <h2>Diagnosis Information</h2>
          <div className="form-grid">
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="diagnosed"
                  checked={formData.diagnosed}
                  onChange={handleChange}
                  disabled={loading}
                />
                Diagnosed
              </label>
            </div>
            <div className="form-group">
              <label htmlFor="diagnosed_date">Diagnosed Date</label>
              <DateInput
                id="diagnosed_date"
                name="diagnosed_date"
                value={formData.diagnosed_date}
                disabled={loading}
                onChange={(value) => handleDateChange('diagnosed_date', value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="diagnosed_by">Diagnosed By</label>
              <input
                type="text"
                id="diagnosed_by"
                name="diagnosed_by"
                value={formData.diagnosed_by}
                onChange={handleChange}
                disabled={loading}
                placeholder="Doctor's name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="diagnosed_at">Diagnosed At</label>
              <input
                type="text"
                id="diagnosed_at"
                name="diagnosed_at"
                value={formData.diagnosed_at}
                onChange={handleChange}
                disabled={loading}
                placeholder="Hospital/Clinic name"
              />
            </div>
          </div>
        </section>

        {/* Transfusion Information */}
        <section className="form-section">
          <h2>Transfusion Information</h2>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="first_transfusion">First Transfusion</label>
              <DateInput
                id="first_transfusion"
                name="first_transfusion"
                value={formData.first_transfusion}
                disabled={loading}
                onChange={(value) => handleDateChange('first_transfusion', value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="number_of_transfusion">Number of Transfusions</label>
              <input
                type="number"
                id="number_of_transfusion"
                name="number_of_transfusion"
                value={formData.number_of_transfusion}
                onChange={handleChange}
                min="0"
                disabled={loading}
              />
            </div>
          </div>
        </section>

        {/* Medical Information */}
        <section className="form-section">
          <h2>Medical Information</h2>
          <div className="form-grid">
            <div className="form-group full-width">
              <label htmlFor="complications">Complications</label>
              <textarea
                id="complications"
                name="complications"
                value={formData.complications}
                onChange={handleChange}
                disabled={loading}
                rows={3}
                placeholder="Describe any complications"
              />
            </div>
            <div className="form-group full-width">
              <label htmlFor="iron_chelation">Iron Chelation</label>
              <textarea
                id="iron_chelation"
                name="iron_chelation"
                value={formData.iron_chelation}
                onChange={handleChange}
                disabled={loading}
                rows={3}
                placeholder="Iron chelation treatment details"
              />
            </div>
            <div className="form-group full-width">
              <label htmlFor="health_condition">Health Condition</label>
              <textarea
                id="health_condition"
                name="health_condition"
                value={formData.health_condition}
                onChange={handleChange}
                disabled={loading}
                rows={3}
                placeholder="Current health condition"
              />
            </div>
            <div className="form-group full-width">
              <label htmlFor="other_medications">Other Medications</label>
              <textarea
                id="other_medications"
                name="other_medications"
                value={formData.other_medications}
                onChange={handleChange}
                disabled={loading}
                rows={3}
                placeholder="List other medications"
              />
            </div>
          </div>
        </section>

        {/* Immunizations */}
        <section className="form-section">
          <h2>Immunizations</h2>
          <div className="form-subsection">
            <h3>BCG/OPV/DPV</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="bcg_opv_dpv_1st">1st Dose</label>
                <DateInput
                  id="bcg_opv_dpv_1st"
                  name="bcg_opv_dpv_1st"
                  value={formData.bcg_opv_dpv_1st}
                  disabled={loading}
                  onChange={(value) => handleDateChange('bcg_opv_dpv_1st', value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="bcg_opv_dpv_2nd">2nd Dose</label>
                <DateInput
                  id="bcg_opv_dpv_2nd"
                  name="bcg_opv_dpv_2nd"
                  value={formData.bcg_opv_dpv_2nd}
                  disabled={loading}
                  onChange={(value) => handleDateChange('bcg_opv_dpv_2nd', value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="bcg_opv_dpv_3rd">3rd Dose</label>
                <DateInput
                  id="bcg_opv_dpv_3rd"
                  name="bcg_opv_dpv_3rd"
                  value={formData.bcg_opv_dpv_3rd}
                  disabled={loading}
                  onChange={(value) => handleDateChange('bcg_opv_dpv_3rd', value)}
                />
              </div>
            </div>
          </div>
          <div className="form-subsection">
            <h3>Measles</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="measles_1st">1st Dose</label>
                <DateInput
                  id="measles_1st"
                  name="measles_1st"
                  value={formData.measles_1st}
                  disabled={loading}
                  onChange={(value) => handleDateChange('measles_1st', value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="measles_2nd">2nd Dose</label>
                <DateInput
                  id="measles_2nd"
                  name="measles_2nd"
                  value={formData.measles_2nd}
                  disabled={loading}
                  onChange={(value) => handleDateChange('measles_2nd', value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="measles_3rd">3rd Dose</label>
                <DateInput
                  id="measles_3rd"
                  name="measles_3rd"
                  value={formData.measles_3rd}
                  disabled={loading}
                  onChange={(value) => handleDateChange('measles_3rd', value)}
                />
              </div>
            </div>
          </div>
          <div className="form-subsection">
            <h3>Hepatitis</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="hepatitis_1st">1st Dose</label>
                <DateInput
                  id="hepatitis_1st"
                  name="hepatitis_1st"
                  value={formData.hepatitis_1st}
                  disabled={loading}
                  onChange={(value) => handleDateChange('hepatitis_1st', value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="hepatitis_2nd">2nd Dose</label>
                <DateInput
                  id="hepatitis_2nd"
                  name="hepatitis_2nd"
                  value={formData.hepatitis_2nd}
                  disabled={loading}
                  onChange={(value) => handleDateChange('hepatitis_2nd', value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="hepatitis_3rd">3rd Dose</label>
                <DateInput
                  id="hepatitis_3rd"
                  name="hepatitis_3rd"
                  value={formData.hepatitis_3rd}
                  disabled={loading}
                  onChange={(value) => handleDateChange('hepatitis_3rd', value)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Address Information */}
        <section className="form-section">
          <h2>Address Information</h2>
          <div className="form-subsection">
            <h3>Temporary Address</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="address_temporary">Address</label>
                <textarea
                  id="address_temporary"
                  name="address_temporary"
                  value={formData.address_temporary}
                  onChange={handleChange}
                  disabled={loading}
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label htmlFor="mobile_temporary">Mobile</label>
                <input
                  type="tel"
                  id="mobile_temporary"
                  name="mobile_temporary"
                  value={formData.mobile_temporary}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="9841234567"
                />
              </div>
            </div>
          </div>
          <div className="form-subsection">
            <h3>Permanent Address</h3>
            <div className="form-grid">
              <div className="form-group full-width">
                <label htmlFor="address_permanent">Address</label>
                <textarea
                  id="address_permanent"
                  name="address_permanent"
                  value={formData.address_permanent}
                  onChange={handleChange}
                  disabled={loading}
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label htmlFor="mobile_permanent">Mobile</label>
                <input
                  type="tel"
                  id="mobile_permanent"
                  name="mobile_permanent"
                  value={formData.mobile_permanent}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="9841234567"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Family Information */}
        <section className="form-section">
          <h2>Family Information</h2>
          <div className="form-subsection">
            <h3>Father</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="father_name">Name</label>
                <input
                  type="text"
                  id="father_name"
                  name="father_name"
                  value={formData.father_name}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="father_birth_place">Birth Place</label>
                <input
                  type="text"
                  id="father_birth_place"
                  name="father_birth_place"
                  value={formData.father_birth_place}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="father_occupation">Occupation</label>
                <input
                  type="text"
                  id="father_occupation"
                  name="father_occupation"
                  value={formData.father_occupation}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
              <div className="form-group full-width">
                <label htmlFor="father_migration_history">Migration History</label>
                <textarea
                  id="father_migration_history"
                  name="father_migration_history"
                  value={formData.father_migration_history}
                  onChange={handleChange}
                  disabled={loading}
                  rows={2}
                />
              </div>
            </div>
          </div>
          <div className="form-subsection">
            <h3>Mother</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="mother_name">Name</label>
                <input
                  type="text"
                  id="mother_name"
                  name="mother_name"
                  value={formData.mother_name}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="mother_birth_place">Birth Place</label>
                <input
                  type="text"
                  id="mother_birth_place"
                  name="mother_birth_place"
                  value={formData.mother_birth_place}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="mother_occupation">Occupation</label>
                <input
                  type="text"
                  id="mother_occupation"
                  name="mother_occupation"
                  value={formData.mother_occupation}
                  onChange={handleChange}
                  disabled={loading}
                />
              </div>
              <div className="form-group full-width">
                <label htmlFor="mother_migration_history">Migration History</label>
                <textarea
                  id="mother_migration_history"
                  name="mother_migration_history"
                  value={formData.mother_migration_history}
                  onChange={handleChange}
                  disabled={loading}
                  rows={2}
                />
              </div>
            </div>
          </div>
          <div className="form-group full-width">
            <label htmlFor="other_thalassemic_family">Other Thalassemic Family</label>
            <textarea
              id="other_thalassemic_family"
              name="other_thalassemic_family"
              value={formData.other_thalassemic_family}
              onChange={handleChange}
              disabled={loading}
              rows={3}
              placeholder="List other family members with thalassemia"
            />
          </div>
        </section>

        <section className="form-section">
          <h2>Documents</h2>
          <p className="form-help-text">
            Upload documents for this patient. Files are uploaded after the patient is saved.
          </p>
          <div className="document-uploads">
            {documents.map((doc, index) => (
              <div className="document-row" key={doc.id}>
                <div className="form-group">
                  <label htmlFor={`document_type_${doc.id}`}>Document Type</label>
                  <select
                    id={`document_type_${doc.id}`}
                    value={doc.documentType}
                    onChange={(event) =>
                      handleDocumentChange(doc.id, 'documentType', event.target.value)
                    }
                    disabled={loading}
                  >
                    <option value="">Select type</option>
                    <option value="patient_photo">Patient Photo</option>
                    <option value="diagnosis_report">Diagnosis Report</option>
                    <option value="hospital_letter">Hospital Letter</option>
                    <option value="lab_report">Lab Report</option>
                    <option value="medical_record">Medical Record</option>
                    <option value="citizenship_patient">Citizenship (Patient)</option>
                    <option value="citizenship_father">Citizenship (Father)</option>
                    <option value="citizenship_mother">Citizenship (Mother)</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor={`document_file_${doc.id}`}>File</label>
                  <input
                    id={`document_file_${doc.id}`}
                    type="file"
                    onChange={(event) =>
                      handleFileChange(doc.id, event.target.files?.[0] || null)
                    }
                    disabled={loading}
                    accept="image/*,application/pdf,.doc,.docx"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor={`document_issuing_${doc.id}`}>Issuing Authority</label>
                  <input
                    id={`document_issuing_${doc.id}`}
                    type="text"
                    value={doc.issuingAuthority}
                    onChange={(event) =>
                      handleDocumentChange(doc.id, 'issuingAuthority', event.target.value)
                    }
                    disabled={loading}
                    placeholder="Hospital/Clinic name"
                  />
                </div>
                <div className="document-actions">
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeDocumentRow(doc.id)}
                    disabled={loading || documents.length === 1}
                  >
                    Remove
                  </button>
                </div>
                {index < documents.length - 1 && <div className="document-row-divider" />}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={addDocumentRow}
            disabled={loading}
          >
            + Add Another Document
          </button>
        </section>

        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Saving...' : patient ? 'Update Patient' : 'Register Patient'}
          </button>
        </div>
      </form>
    </div>
  );
}
