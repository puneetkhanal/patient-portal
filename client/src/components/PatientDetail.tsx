import { useEffect, useMemo, useState } from 'react';

import { Patient } from '../types';
import { useAuth, getAuthHeaders } from '../contexts/AuthContext';
import { useCalendarMode } from '../contexts/CalendarContext';
import { formatDisplayDate } from '../utils/dateFormat';
import './PatientDetail.css';

interface PatientDetailProps {
  patientId: string;
  onBack: () => void;
  onEdit: (_patient: Patient) => void;
  canEdit: boolean;
}

interface PatientDocument {
  _id: string;
  documentType: string;
  fileName: string;
  mimeType: string;
  status: string;
  uploadDate: string;
}

export function PatientDetail({ patientId, onBack, onEdit, canEdit }: PatientDetailProps) {
  const { token } = useAuth();
  const { calendarMode } = useCalendarMode();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [documents, setDocuments] = useState<PatientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/patients/${patientId}?includeDocuments=true`, {
          headers: getAuthHeaders(token)
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to load patient');
        }

        if (active) {
          setPatient(data.data.patient);
          setDocuments(data.data.documents || []);
        }
      } catch (err) {
        if (active) {
          setError((err as Error).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [patientId, token]);

  const patientPhoto = useMemo(
    () => documents.find((doc) => doc.documentType === 'patient_photo'),
    [documents]
  );

  useEffect(() => {
    let url: string | null = null;
    const loadPhoto = async () => {
      if (!patientPhoto || !patientPhoto.mimeType.startsWith('image/')) return;
      try {
        const response = await fetch(
          `/api/patients/${patientId}/documents/${patientPhoto._id}/download`,
          { headers: getAuthHeaders(token) }
        );
        if (!response.ok) return;
        const blob = await response.blob();
        url = URL.createObjectURL(blob);
        setPhotoUrl(url);
      } catch {
        // ignore image load errors
      }
    };

    loadPhoto();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [patientId, patientPhoto, token]);

  const handleDownload = async (doc: PatientDocument) => {
    const response = await fetch(
      `/api/patients/${patientId}/documents/${doc._id}/download`,
      { headers: getAuthHeaders(token) }
    );
    if (!response.ok) {
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = doc.fileName || 'document';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="patient-detail">
        <div className="patient-detail__loading">Loading patient...</div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="patient-detail">
        <div className="patient-detail__error">{error || 'Patient not found'}</div>
        <button className="patient-detail__back" onClick={onBack}>
          Back to Patients
        </button>
      </div>
    );
  }

  const formatDate = (value?: string | null) =>
    formatDisplayDate(value, calendarMode).replace('N/A', '—');

  return (
    <div className="patient-detail">
      <div className="patient-detail__header">
        <div>
          <h1>{patient.patient_name}</h1>
          <p className="patient-detail__subtitle">Reg. No: {patient.registered_no}</p>
        </div>
        <div className="patient-detail__actions">
          {canEdit && (
            <button className="patient-detail__button" onClick={() => onEdit(patient)}>
              Edit Patient
            </button>
          )}
          <button className="patient-detail__button patient-detail__button--ghost" onClick={onBack}>
            Back
          </button>
        </div>
      </div>

      <div className="patient-detail__grid">
        <section className="patient-detail__card">
          <h2>Patient Overview</h2>
          {photoUrl ? (
            <img className="patient-detail__photo" src={photoUrl} alt="Patient" />
          ) : (
            <div className="patient-detail__photo-placeholder">No Photo</div>
          )}
          <div className="patient-detail__info">
            <div>
              <span>Date of Birth</span>
              <strong>{formatDate(patient.dob)}</strong>
            </div>
            <div>
              <span>Gender</span>
              <strong>{patient.gender || '—'}</strong>
            </div>
            <div>
              <span>Blood Group</span>
              <strong>{patient.blood_group || '—'}</strong>
            </div>
            <div>
              <span>Registered</span>
              <strong>{formatDate(patient.registered_date)}</strong>
            </div>
          </div>
        </section>

        <section className="patient-detail__card">
          <h2>Medical Details</h2>
          <div className="patient-detail__info">
            <div>
              <span>Diagnosed</span>
              <strong>{patient.diagnosed ? 'Yes' : 'No'}</strong>
            </div>
            <div>
              <span>Diagnosed Date</span>
              <strong>{formatDate(patient.diagnosed_date)}</strong>
            </div>
            <div>
              <span>Diagnosed By</span>
              <strong>{patient.diagnosed_by || '—'}</strong>
            </div>
            <div>
              <span>Transfusions</span>
              <strong>{patient.number_of_transfusion ?? 0}</strong>
            </div>
          </div>
        </section>

        <section className="patient-detail__card patient-detail__card--full">
          <h2>Documents</h2>
          {documents.length === 0 ? (
            <div className="patient-detail__empty">No documents uploaded.</div>
          ) : (
            <div className="patient-detail__docs">
              {documents.map((doc) => (
                <div className="patient-detail__doc" key={doc._id}>
                  <div>
                    <strong>{doc.documentType.replace(/_/g, ' ')}</strong>
                    <div className="patient-detail__doc-meta">
                      {doc.fileName} • {doc.status}
                    </div>
                  </div>
                  <button className="patient-detail__button" onClick={() => handleDownload(doc)}>
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
