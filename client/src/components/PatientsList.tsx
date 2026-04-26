import { useEffect, useState } from 'react';

import { Patient } from '../types';
import { useAuth, getAuthHeaders } from '../contexts/AuthContext';
import { useCalendarMode } from '../contexts/CalendarContext';
import { formatDisplayDate } from '../utils/dateFormat';
import './PatientsList.css';

interface PatientsListProps {
  onAddNew: () => void;
  onEdit: (_patient: Patient) => void;
  onView: (_patient: Patient) => void;
}

export function PatientsList({ onAddNew, onEdit, onView }: PatientsListProps) {
  const { token, user } = useAuth();
  const { calendarMode } = useCalendarMode();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalPatients, setTotalPatients] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const isSuperAdmin = user?.role === 'super_admin';

  useEffect(() => {
    fetchPatients();
  }, [token, currentPage, pageSize, searchTerm]);

  const fetchPatients = async () => {
    try {
      setIsFetching(true);
      setError('');
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(pageSize)
      });
      if (searchTerm.trim()) {
        params.set('search', searchTerm.trim());
      }

      const response = await fetch(`/api/patients?${params.toString()}`, {
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication required. Please login again.');
          return;
        }
        throw new Error('Failed to fetch patients');
      }

      const responseData = await response.json();
      if (responseData.success && responseData.data) {
        const normalized = (responseData.data.patients || []).map((patient: Patient) => ({
          ...patient,
          id: patient.id || patient._id
        }));
        setPatients(normalized);
        const pagination = responseData.data.pagination;
        if (pagination) {
          setTotalPatients(pagination.total || 0);
          setTotalPages(Math.max(1, pagination.pages || 1));
          if (pagination.page && pagination.page !== currentPage) {
            setCurrentPage(pagination.page);
          }
        } else {
          setTotalPatients(normalized.length);
          setTotalPages(1);
        }
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load patients');
      setPatients([]);
      setTotalPatients(0);
      setTotalPages(1);
    } finally {
      setInitialLoading(false);
      setIsFetching(false);
    }
  };

  const handleDelete = async (id: string, registeredNo: string) => {
    if (!window.confirm(`Are you sure you want to delete patient ${registeredNo}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/patients/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || errorData?.error || 'Failed to delete patient');
      }

      // Refresh the list
      fetchPatients();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Failed to delete patient');
    }
  };

  const formatDate = (dateString: string | null) =>
    formatDisplayDate(dateString, calendarMode);

  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = totalPatients === 0 ? 0 : (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalPatients);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (initialLoading && patients.length === 0 && !error) {
    return (
      <div className="patients-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading patients...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="patients-container">
      <div className="patients-header">
        <div>
          <h1>Patients</h1>
          <p className="patients-count">
            {totalPatients} patient{totalPatients !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button className="btn btn-primary" onClick={onAddNew}>
          + Register New Patient
        </button>
      </div>

      <div className="patients-toolbar">
        <div className="patients-search">
          <label className="patients-search-label" htmlFor="patients-search">
            Search
          </label>
          <input
            id="patients-search"
            type="search"
            placeholder="Search by name or reg. no"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        {isFetching && (
          <div className="patients-fetching" role="status" aria-live="polite">
            Updating results...
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={fetchPatients} className="btn btn-danger btn-sm">Retry</button>
        </div>
      )}

      {patients.length === 0 && !error && !searchTerm.trim() ? (
        <div className="empty-state">
          <p>No patients registered yet.</p>
          <button className="btn btn-primary" onClick={onAddNew}>
            Register First Patient
          </button>
        </div>
      ) : patients.length === 0 && !error ? (
        <div className="empty-state">
          <p>No patients match your search.</p>
          <button
            className="btn btn-secondary"
            onClick={() => setSearchTerm('')}
          >
            Clear Search
          </button>
        </div>
      ) : (
        <>
          <div className="patients-table-container">
            <table className="patients-table">
              <thead>
                <tr>
                  <th>Reg. No</th>
                  <th>Name</th>
                  <th>DOB</th>
                  <th>Gender</th>
                  <th>Blood Group</th>
                  <th>Registered Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient.id || patient._id}>
                    <td className="reg-no">
                      <button
                        className="patient-link"
                        onClick={() => onView(patient)}
                        title="View patient details"
                      >
                        {patient.registered_no}
                      </button>
                    </td>
                    <td className="patient-name">{patient.patient_name}</td>
                    <td>{formatDate(patient.dob)}</td>
                    <td>{patient.gender || 'N/A'}</td>
                    <td>{patient.blood_group || 'N/A'}</td>
                    <td>{formatDate(patient.registered_date)}</td>
                    <td className="actions">
                      {isSuperAdmin ? (
                        <>
                          <button
                            className="btn btn-info btn-sm"
                            onClick={() => onEdit(patient)}
                            title="Edit patient"
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete((patient.id || patient._id) as string, patient.registered_no)}
                            title="Delete patient"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <span className="actions-muted">No access</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="patients-pagination">
            <div className="pagination-info">
              Showing {totalPatients === 0 ? 0 : startIndex + 1}-{endIndex} of {totalPatients}
            </div>
            <div className="pagination-controls">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={safeCurrentPage === 1}
              >
                Previous
              </button>
              <span className="pagination-page">
                Page {safeCurrentPage} of {totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={safeCurrentPage === totalPages}
              >
                Next
              </button>
              <label className="pagination-size">
                Rows per page
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
