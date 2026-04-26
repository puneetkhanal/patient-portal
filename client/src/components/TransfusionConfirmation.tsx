import { useEffect, useMemo, useState } from 'react';

import { Patient, TransfusionRecord } from '../types';
import { getAuthHeaders, useAuth } from '../contexts/AuthContext';
import { useCalendarMode } from '../contexts/CalendarContext';
import { formatDisplayDate } from '../utils/dateFormat';
import './TransfusionConfirmation.css';

export function TransfusionConfirmation() {
  const { token, user } = useAuth();
  const { calendarMode } = useCalendarMode();
  const canManage = user?.role === 'data_entry' || user?.role === 'super_admin';
  const [patients, setPatients] = useState<Patient[]>([]);
  const [records, setRecords] = useState<TransfusionRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    loadPatients();
    loadAllRecords();
  }, [token]);

  const loadPatients = async () => {
    const response = await fetch('/api/patients?limit=2000', {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      return;
    }
    const data = await response.json();
    const list = (data.data?.patients || []).map((patient: Patient) => ({
      ...patient,
      id: patient.id || patient._id
    }));
    setPatients(list);
  };

  const patientMap = useMemo(() => {
    const map = new Map<string, Patient>();
    patients.forEach((patient) => {
      const id = (patient.id || patient._id) as string;
      if (id) {
        map.set(id, patient);
      }
    });
    return map;
  }, [patients]);

  const loadAllRecords = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/transfusion-records', {
        headers: getAuthHeaders(token),
      });
      if (!response.ok) {
        throw new Error('Failed to load transfusion records');
      }
      const data = await response.json();
      setRecords(data.data?.records || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transfusion records');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('Delete this transfusion record?')) {
      return;
    }
    setDeletingId(recordId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/transfusion-records/${recordId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to delete transfusion record');
      }
      setRecords((prev) => prev.filter((record) => record._id !== recordId));
      setSuccess('Transfusion record deleted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete transfusion record');
    } finally {
      setDeletingId(null);
    }
  };

  if (!canManage) {
    return (
      <div className="transfusion-confirmation-container">
        <div className="error-message">You do not have access to Transfusion Confirmation.</div>
      </div>
    );
  }

  return (
    <div className="transfusion-confirmation-container">
      <div className="transfusion-confirmation-header">
        <div>
          <h1>Transfusion Records</h1>
          <p>View and manage confirmed transfusion records.</p>
        </div>
        <div className="confirm-controls">
          <button className="btn btn-secondary" onClick={loadAllRecords} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh Records'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {records.length > 0 && (
        <div className="confirmation-card">
          <div className="plan-meta">Transfusion Records</div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Outcome</th>
                  <th>Actual Date</th>
                  <th>Units</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const patient = patientMap.get(record.patientId);
                  return (
                    <tr key={record._id}>
                      <td>
                        {patient?.patient_name || record.patientId}
                      </td>
                      <td>{record.outcome}</td>
                      <td>{formatDisplayDate(record.actualDate, calendarMode)}</td>
                      <td>{record.unitsTransfused}</td>
                      <td>{record.notes || '—'}</td>
                      <td>
                        {user?.role === 'super_admin' && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteRecord(record._id)}
                            disabled={deletingId === record._id}
                          >
                            {deletingId === record._id ? 'Deleting...' : 'Delete'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
