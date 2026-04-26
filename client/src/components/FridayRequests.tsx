import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { Patient, Settings, WeeklyRequest } from '../types';
import { getAuthHeaders, useAuth } from '../contexts/AuthContext';
import { useCalendarMode } from '../contexts/CalendarContext';
import { formatDisplayDate, formatDisplayRange } from '../utils/dateFormat';
import { getTodayBs } from '../utils/nepaliDate';

import { DateInput } from './DateInput';
import './FridayRequests.css';

interface WeeklyRequestsResponse {
  requests: WeeklyRequest[];
  weekStart: string;
  weekEnd: string;
}

interface AvailabilityResponse {
  weekStart: string;
  weekEnd: string;
  days: Array<{ name: string; date: string }>;
  hospitals: Array<{
    name: string;
    capacityByDay: Record<string, number>;
    plannedByDay: Record<string, number>;
  }>;
}

export function FridayRequests() {
  const { token, user } = useAuth();
  const { calendarMode } = useCalendarMode();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [requests, setRequests] = useState<WeeklyRequest[]>([]);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [plans, setPlans] = useState<{ _id: string; weekStart: string; weekEnd: string; status: string }[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [activePlan, setActivePlan] = useState<{ _id: string; weekStart: string; weekEnd: string; status: string } | null>(null);
  const [emailContent, setEmailContent] = useState<string>('');
  const [emailLoading, setEmailLoading] = useState<boolean>(false);
  const [showEmailPanel, setShowEmailPanel] = useState<boolean>(false);
  const [weekStartDate, setWeekStartDate] = useState<string>(getTodayBs());
  const [callDate, setCallDate] = useState<string>(getTodayBs());
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [patientSearch, setPatientSearch] = useState<string>('');
  const [requestedUnits, setRequestedUnits] = useState<1 | 2>(1);
  const [requestedHospital, setRequestedHospital] = useState<string>('');
  const [preferredDate, setPreferredDate] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [warningMessage, setWarningMessage] = useState<string>('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [availabilityError, setAvailabilityError] = useState<string>('');

  const canManage = user?.role === 'data_entry' || user?.role === 'super_admin';

  useEffect(() => {
    loadInitial();
  }, [token]);

  const loadInitial = async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsResult] = await Promise.all([
        fetchSettings(),
        fetchPatients()
      ]);
      const planList = await fetchPlans();
      if (!activePlan && planList.length > 0) {
        const today = new Date();
        const todayIso = today.toISOString().slice(0, 10);
        const futurePlans = planList
          .filter((plan) => plan.weekStart.slice(0, 10) >= todayIso)
          .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
        const nextPlan = futurePlans[0] || planList[0];
        setSelectedPlanId(nextPlan._id);
        await openPlan(nextPlan);
      }
      if (settingsResult?.hospitalList?.length) {
        setRequestedHospital(settingsResult.hospitalList[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Friday requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async (): Promise<Settings | null> => {
    const response = await fetch('/api/settings', {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to load settings');
    }
    const data = await response.json();
    const settingsData = data.data?.settings as Settings;
    setSettings(settingsData);
    return settingsData;
  };

  const fetchPatients = async () => {
    const response = await fetch('/api/patients?limit=2000', {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to load patients');
    }
    const data = await response.json();
    const list = (data.data?.patients || []).map((patient: Patient) => ({
      ...patient,
      id: patient.id || patient._id
    }));
    setPatients(list);
  };

  const fetchPlans = async () => {
    const response = await fetch('/api/weekly-plans?limit=50', {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    const list = data.data?.plans || [];
    setPlans(list);
    return list as { _id: string; weekStart: string; weekEnd: string; status: string }[];
  };

  const fetchRequests = async (date: string) => {
    setError('');
    const response = await fetch(`/api/weekly-requests?weekStart=${encodeURIComponent(date)}`, {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to load weekly requests');
    }
    const data = await response.json();
    const responseData = data.data as WeeklyRequestsResponse;
    setRequests(responseData.requests || []);
  };

  const fetchAvailability = async (date: string) => {
    setAvailabilityError('');
    const response = await fetch(`/api/weekly-requests/availability?weekStart=${encodeURIComponent(date)}`, {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      setAvailability(null);
      setAvailabilityError('Failed to load hospital availability.');
      return;
    }
    const data = await response.json();
    setAvailability(data.data as AvailabilityResponse);
  };

  const filteredPatients = useMemo(() => {
    const search = patientSearch.trim().toLowerCase();
    const results = patients.filter((patient) => {
      if (!search) return true;
      return (
        patient.registered_no?.toLowerCase().includes(search) ||
        patient.patient_name?.toLowerCase().includes(search)
      );
    });
    return results.slice(0, 50);
  }, [patientSearch, patients]);

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

  const selectedPatient = selectedPatientId ? patientMap.get(selectedPatientId) : null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPatientId) {
      setError('Please select a patient');
      return;
    }
    if (!requestedHospital) {
      setError('Please select a hospital');
      return;
    }
    if (!preferredDate) {
      setError('Please select a preferred date');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMessage('');
    setWarningMessage('');
    try {
      const response = await fetch('/api/weekly-requests', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          patientId: selectedPatientId,
          callDate,
          requestedUnits,
          requestedHospital,
          preferredDate: preferredDate || undefined,
          remarks: remarks || undefined
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to create weekly request');
      }

      if (data?.data?.warningBackEntry) {
        setWarningMessage('Back-entry warning: call date is not Friday.');
      }

      setSuccessMessage('Weekly request saved.');
      setRemarks('');
      setPreferredDate('');
      await fetchRequests(weekStartDate);
      await fetchAvailability(weekStartDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create weekly request');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm('Delete this weekly request?')) {
      return;
    }
    setDeletingId(requestId);
    setError('');
    setSuccessMessage('');
    try {
      const response = await fetch(`/api/weekly-requests/${requestId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to delete weekly request');
      }
      setSuccessMessage('Weekly request deleted.');
      await fetchRequests(weekStartDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete weekly request');
    } finally {
      setDeletingId(null);
    }
  };

  const openPlan = async (plan: { _id: string; weekStart: string; weekEnd: string; status: string }) => {
    setActivePlan(plan);
    setWeekStartDate(plan.weekStart.slice(0, 10));
    await fetchRequests(plan.weekStart);
    await fetchAvailability(plan.weekStart);
  };

  const handleOpenPlan = async (planId: string) => {
    if (!planId) return;
    const plan = plans.find((entry) => entry._id === planId);
    if (!plan) return;
    await openPlan(plan);
  };

  const handleGenerateEmail = async () => {
    if (!activePlan) return;
    setEmailLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/weekly-plans/${activePlan._id}`, {
        headers: getAuthHeaders(token),
      });
      if (!response.ok) {
        throw new Error('Failed to load weekly plan');
      }
      const data = await response.json();
      const items = (data.data?.items || []) as Array<{
        patientId: string;
        assignedHospital: string;
        assignedUnits: number;
      }>;

      const hospitalMap = new Map<string, Map<string, number>>();
      const bloodGroups = settings?.bloodGroups?.length ? settings.bloodGroups : [];

      for (const item of items) {
        const patient = patientMap.get(item.patientId);
        const group = patient?.blood_group || 'Unknown';
        const hospital = item.assignedHospital || 'Unknown Hospital';
        if (!hospitalMap.has(hospital)) {
          hospitalMap.set(hospital, new Map<string, number>());
        }
        const groupMap = hospitalMap.get(hospital)!;
        groupMap.set(group, (groupMap.get(group) || 0) + (item.assignedUnits || 0));
      }

      const hospitalEntries = Array.from(hospitalMap.entries());
      const lines: string[] = [];
      hospitalEntries.forEach(([hospital, groupMap], index) => {
        if (index > 0) lines.push('');
        lines.push(`Blood Bank, ${hospital}`);
        lines.push('');

        const groupsToPrint = bloodGroups.length > 0 ? bloodGroups : Array.from(groupMap.keys());
        groupsToPrint.forEach((group) => {
          const units = groupMap.get(group) || 0;
          if (units > 0) {
            lines.push(`${group} = ${units} units`);
          }
        });

        if (lines[lines.length - 1] !== '') {
          lines.push('');
        }
      });

      lines.push('Managing Officer');
      lines.push('Patient Care Team');
      setEmailContent(lines.join('\n'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate email content');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleCopyEmail = async () => {
    if (!emailContent) return;
    try {
      await navigator.clipboard.writeText(emailContent);
      setSuccessMessage('Email content copied.');
    } catch {
      setError('Failed to copy email content.');
    }
  };

  const formatDate = (dateString: string | null | undefined) =>
    formatDisplayDate(dateString, calendarMode);

  if (!canManage) {
    return (
      <div className="friday-requests-container">
        <div className="error-message">You do not have access to Friday Requests.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="friday-requests-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading Friday requests...</p>
        </div>
      </div>
    );
  }

  const hospitalOptions = settings?.hospitalList?.length
    ? settings.hospitalList
    : ["General Hospital", 'Community Hospital'];

  return (
    <div className="friday-requests-container">
      <div className="friday-requests-header">
        <div>
          <h1>Friday Requests</h1>
          <p className="friday-requests-subtitle">
            Register weekly blood requests and prepare the upcoming plan.
          </p>
        </div>
        {activePlan && (
          <div className="friday-requests-week">
            <label>Week of</label>
            <span className="week-range">
              {formatDisplayRange(activePlan.weekStart, activePlan.weekEnd, calendarMode)}
            </span>
          </div>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}
      {availabilityError && <div className="warning-message">{availabilityError}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}
      {warningMessage && <div className="warning-message">{warningMessage}</div>}

      {plans.length > 0 && (
        <div className="friday-plan-link">
          <div className="plan-link-left">
            <div className="plan-link-label">Open Weekly Plan</div>
            <select
              value={selectedPlanId}
              onChange={(event) => {
                const value = event.target.value;
                setSelectedPlanId(value);
                handleOpenPlan(value);
              }}
            >
              <option value="">Select a plan</option>
              {plans.map((plan) => (
                <option key={plan._id} value={plan._id}>
                  {formatDisplayRange(plan.weekStart, plan.weekEnd, calendarMode)} ({plan.status})
                </option>
              ))}
            </select>
          </div>
          {activePlan && (
            <div className="plan-link-right">
              <button
                className="btn btn-secondary"
                onClick={() => setShowEmailPanel((prev) => !prev)}
              >
                {showEmailPanel ? 'Hide Email' : 'Email Template'}
              </button>
            </div>
          )}
        </div>
      )}

      {!activePlan && (
        <div className="empty-state">Select a weekly plan to view requests and availability.</div>
      )}

      {activePlan && availability && (
        <div className="friday-availability-card">
          <div className="availability-header">
            <div>
              <h2>Hospital Bed Availability</h2>
              <p>Upcoming week slots by hospital and day.</p>
            </div>
            <button className="btn btn-secondary" onClick={() => fetchAvailability(weekStartDate)}>
              Refresh
            </button>
          </div>
          <div className="table-scroll">
            <table className="availability-table">
              <thead>
                <tr>
                  <th>Hospital</th>
                  {availability.days.map((day) => (
                    <th key={day.name}>
                      {day.name.slice(0, 3)}
                      <span className="availability-date">{day.date}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {availability.hospitals.map((hospital) => (
                  <tr key={hospital.name}>
                    <td className="availability-hospital">{hospital.name}</td>
                    {availability.days.map((day) => {
                      const capacity = hospital.capacityByDay?.[day.name] ?? 0;
                      const planned = hospital.plannedByDay?.[day.name] ?? 0;
                      const used = planned;
                      const remaining = Math.max(capacity - used, 0);
                      const isFull = capacity > 0 && used >= capacity;
                      const isAvailable = capacity > 0 && used < capacity;
                      return (
                        <td key={`${hospital.name}-${day.name}`}>
                          <div className={`availability-cell ${isFull ? 'is-full' : ''} ${isAvailable ? 'is-available' : ''}`}>
                            <div className="availability-count">
                              {used}/{capacity}
                            </div>
                            <div className="availability-meta">
                              <span>Planned {planned}</span>
                              <span>Remaining {remaining}</span>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activePlan && showEmailPanel && (
        <div className="email-modal-overlay" onClick={() => setShowEmailPanel(false)}>
          <div className="email-modal" onClick={(event) => event.stopPropagation()}>
            <div className="email-header">
              <div>
                <h2>Weekly Blood Requirement Email</h2>
                <p>Generate a copy-ready email for blood banks.</p>
              </div>
              <div className="email-actions">
                <button className="btn btn-secondary" onClick={handleGenerateEmail} disabled={emailLoading}>
                  {emailLoading ? 'Generating...' : 'Generate Email'}
                </button>
                <button className="btn btn-primary" onClick={handleCopyEmail} disabled={!emailContent}>
                  Copy
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => setShowEmailPanel(false)}>
                  Close
                </button>
              </div>
            </div>
            <textarea
              className="email-textarea"
              rows={12}
              value={emailContent}
              onChange={(event) => setEmailContent(event.target.value)}
              placeholder="Click Generate Email to populate content."
            />
          </div>
        </div>
      )}

      {activePlan && (
      <div className="friday-requests-card">
        <h2>New Friday Call</h2>
        <form className="friday-requests-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-field">
              <label htmlFor="patientSearch">Patient Search</label>
              <input
                id="patientSearch"
                type="text"
                placeholder="Search by reg no or name"
                value={patientSearch}
                onChange={(event) => setPatientSearch(event.target.value)}
              />
            </div>
            <div className="form-field">
              <label htmlFor="patientSelect">Patient</label>
              <select
                id="patientSelect"
                value={selectedPatientId}
                onChange={(event) => setSelectedPatientId(event.target.value)}
              >
                <option value="">Select a patient</option>
                {filteredPatients.map((patient) => {
                  const id = (patient.id || patient._id) as string;
                  return (
                    <option key={id} value={id}>
                      {patient.registered_no} — {patient.patient_name}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Patient Name</label>
              <input type="text" value={selectedPatient?.patient_name || ''} readOnly />
            </div>
            <div className="form-field">
              <label>Blood Group</label>
              <input type="text" value={selectedPatient?.blood_group || ''} readOnly />
            </div>
            <div className="form-field">
              <label htmlFor="callDate">Call Date</label>
              <DateInput
                id="callDate"
                value={callDate}
                onChange={(value) => setCallDate(value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="requestedUnits">Requested Units</label>
              <select
                id="requestedUnits"
                value={requestedUnits}
                onChange={(event) => setRequestedUnits(Number(event.target.value) as 1 | 2)}
              >
                <option value={1}>1 unit</option>
                <option value={2}>2 units</option>
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="requestedHospital">Requested Hospital</label>
              <select
                id="requestedHospital"
                value={requestedHospital}
                onChange={(event) => setRequestedHospital(event.target.value)}
              >
                {hospitalOptions.map((hospital) => (
                  <option key={hospital} value={hospital}>
                    {hospital}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="preferredDate">Preferred Date</label>
              <DateInput
                id="preferredDate"
                required
                value={preferredDate}
                min={availability?.days?.[0]?.date}
                max={availability?.days?.[availability.days.length - 1]?.date}
                onChange={(value) => setPreferredDate(value)}
              />
              {availability && preferredDate && requestedHospital && (
                <span className="availability-helper">
                  {(() => {
                    const day = availability.days.find((entry) => entry.date === preferredDate);
                    if (!day) return 'Date must be within the selected week.';
                    const hospital = availability.hospitals.find((entry) => entry.name === requestedHospital);
                    if (!hospital) return 'No capacity configured for this hospital.';
                    const capacity = hospital.capacityByDay?.[day.name] ?? 0;
                    const planned = hospital.plannedByDay?.[day.name] ?? 0;
                    const used = planned;
                    const remaining = Math.max(capacity - used, 0);
                    if (capacity === 0) return 'No capacity configured for this day.';
                    if (remaining <= 0) return 'No slots remaining for this date.';
                    return `${remaining} slots remaining for ${day.name}.`;
                  })()}
                </span>
              )}
            </div>
          </div>

          <div className="form-row full-width">
            <div className="form-field">
              <label htmlFor="remarks">Remarks</label>
              <textarea
                id="remarks"
                rows={3}
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
              />
            </div>
          </div>

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Weekly Request'}
            </button>
          </div>
        </form>
      </div>
      )}

      {activePlan && (
      <div className="friday-requests-table">
        <div className="table-header">
          <h2>Requests for the Week</h2>
          <span>{requests.length} request{requests.length !== 1 ? 's' : ''}</span>
        </div>
        {requests.length === 0 ? (
          <div className="empty-state">No requests registered for this week.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Blood Group</th>
                  <th>Units</th>
                  <th>Hospital</th>
                  <th>Call Date</th>
                  <th>Preferred Date</th>
                  <th>Status</th>
                  <th>Warning</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const patient = patientMap.get(request.patientId);
                  return (
                    <tr key={request._id}>
                      <td>
                        <div className="patient-cell">
                          <span className="patient-name">{patient?.patient_name || 'Unknown'}</span>
                          <span className="patient-reg">{patient?.registered_no || request.patientId}</span>
                        </div>
                      </td>
                      <td>{patient?.blood_group || 'N/A'}</td>
                      <td>{request.requestedUnits}</td>
                      <td>{request.requestedHospital}</td>
                      <td>{formatDate(request.callDate)}</td>
                      <td>
                        {request.preferredDate
                          ? formatDisplayDate(request.preferredDate, calendarMode)
                          : (request.preferredDay || '—')}
                      </td>
                      <td className="status-pill">{request.status}</td>
                      <td>{request.warningBackEntry ? 'Back-entry' : '—'}</td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteRequest(request._id)}
                          disabled={deletingId === request._id}
                        >
                          {deletingId === request._id ? 'Deleting...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
