import { Fragment, useEffect, useMemo, useState } from 'react';

import { Patient, Settings, WeeklyPlan, WeeklyPlanItem } from '../types';
import { getAuthHeaders, useAuth } from '../contexts/AuthContext';
import { useCalendarMode } from '../contexts/CalendarContext';
import { formatDisplayRange } from '../utils/dateFormat';
import { getTodayBs } from '../utils/nepaliDate';

import { DateInput } from './DateInput';
import './WeeklyPlan.css';

interface PlanResponse {
  plan: WeeklyPlan;
  items: WeeklyPlanItem[];
}

const LAST_PLAN_KEY = 'weekly_plan_last';
type ConfirmDraft = {
  actualDate: string;
  unitsTransfused: number;
  outcome: string;
  reason: string;
  notes: string;
  open: boolean;
};

export function WeeklyPlanView() {
  const { token, user } = useAuth();
  const { calendarMode } = useCalendarMode();
  const canManage = user?.role === 'data_entry' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';
  const [settings, setSettings] = useState<Settings | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [weekStart, setWeekStart] = useState<string>(getTodayBs());
  const [planId, setPlanId] = useState<string>('');
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [items, setItems] = useState<WeeklyPlanItem[]>([]);
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmDrafts, setConfirmDrafts] = useState<Record<string, ConfirmDraft>>({});

  useEffect(() => {
    if (!token) return;
    loadInitial();
  }, [token]);

  useEffect(() => {
    if (items.length === 0) return;
    setConfirmDrafts((prev) => {
      const next = { ...prev };
      items.forEach((item) => {
        if (!next[item._id]) {
          next[item._id] = {
            actualDate: item.assignedDate?.slice(0, 10) || '',
            unitsTransfused: item.assignedUnits || 0,
            outcome: 'completed',
            reason: '',
            notes: '',
            open: false
          };
        }
      });
      return next;
    });
  }, [items]);

  const loadInitial = async () => {
    setLoading(true);
    setError('');
    try {
      const [, , planList] = await Promise.all([loadSettings(), loadPatients(), loadPlans()]);
      if (planList.length > 0) {
        const recentPlanId = planList[0]._id;
        setPlanId(recentPlanId);
        await fetchPlan(recentPlanId);
        localStorage.setItem(LAST_PLAN_KEY, recentPlanId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weekly plan data');
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    const response = await fetch('/api/settings', {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to load settings');
    }
    const data = await response.json();
    setSettings(data.data?.settings || null);
  };

  const loadPatients = async () => {
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

  const loadPlans = async () => {
    const response = await fetch('/api/weekly-plans?limit=50', {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to load weekly plans');
    }
    const data = await response.json();
    const planList = data.data?.plans || [];
    setPlans(planList);
    return planList as WeeklyPlan[];
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

  const hospitalOptions = settings?.hospitalList?.length
    ? settings.hospitalList
    : ["General Hospital", 'Community Hospital'];

  const fetchPlan = async (id: string) => {
    setError('');
    const response = await fetch(`/api/weekly-plans/${id}`, {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Failed to load weekly plan');
    }
    const data = await response.json();
    const responseData = data.data as PlanResponse;
    setPlan(responseData.plan);
    setItems(responseData.items || []);
  };

  const handleCreatePlan = async () => {
    setError('');
    setStatusMessage('');
    try {
      const response = await fetch('/api/weekly-plans', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ weekStart })
      });

      if (response.status === 409) {
        throw new Error('Weekly plan already exists for this week. Enter the Plan ID to load it.');
      }

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to create weekly plan');
      }
      const responseData = data.data as PlanResponse;
      setPlan(responseData.plan);
      setItems(responseData.items || []);
      setPlanId(responseData.plan._id);
      localStorage.setItem(LAST_PLAN_KEY, responseData.plan._id);
      setStatusMessage('Weekly plan created.');
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create weekly plan');
    }
  };

  const handleLoadPlan = async () => {
    if (!planId) {
      setError('Enter a plan ID to load.');
      return;
    }
    setStatusMessage('');
    try {
      await fetchPlan(planId);
      localStorage.setItem(LAST_PLAN_KEY, planId);
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weekly plan');
    }
  };

  const handleSaveItem = async (item: WeeklyPlanItem) => {
    setSavingItemId(item._id);
    setError('');
    setStatusMessage('');
    try {
      const response = await fetch(`/api/plan-items/${item._id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          assignedHospital: item.assignedHospital,
          assignedDate: item.assignedDate,
          assignedUnits: item.assignedUnits,
          notes: item.notes
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to update plan item');
      }
      setStatusMessage('Plan item updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plan item');
    } finally {
      setSavingItemId(null);
    }
  };

  const handleConfirmTransfusion = async (itemId: string) => {
    const draft = confirmDrafts[itemId];
    if (!draft) return;
    setConfirmingId(itemId);
    setError('');
    setStatusMessage('');
    try {
      let actualDate = draft.actualDate;
      let unitsTransfused = draft.unitsTransfused;
      let outcome = draft.outcome;
      let reason = draft.reason;
      let notes = draft.notes;

      if (typeof document !== 'undefined') {
        const panel = document.querySelector(`.confirm-panel[data-item-id="${itemId}"]`);
        if (panel) {
          const dateInput = panel.querySelector('input[type="text"], input[type="date"]') as HTMLInputElement | null;
          if (dateInput?.value) {
            actualDate = dateInput.value;
          }
          const unitsInput = panel.querySelector('input[type="number"]') as HTMLInputElement | null;
          if (unitsInput?.value) {
            unitsTransfused = Number(unitsInput.value);
          }
          const outcomeSelect = panel.querySelector('select') as HTMLSelectElement | null;
          if (outcomeSelect?.value) {
            outcome = outcomeSelect.value;
          }
          const textInputs = panel.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
          if (textInputs.length > 1) {
            reason = textInputs[1].value;
          }
          if (textInputs.length > 2) {
            notes = textInputs[2].value;
          }
        }
      }

      const response = await fetch(`/api/plan-items/${itemId}/confirm`, {
        method: 'PATCH',
        headers: getAuthHeaders(token),
        body: JSON.stringify({
          actualDate,
          unitsTransfused: Number(unitsTransfused),
          outcome,
          reason: reason || undefined,
          notes: notes || undefined
        })
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to confirm transfusion');
      }
      setItems((prev) =>
        prev.map((row) =>
          row._id === itemId ? { ...row, status: draft.outcome } : row
        )
      );
      setStatusMessage('Transfusion confirmed.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm transfusion');
    } finally {
      setConfirmingId(null);
    }
  };

  const toggleConfirmOpen = (itemId: string) => {
    setConfirmDrafts((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        open: !prev[itemId]?.open
      }
    }));
  };

  const updateConfirmDraft = (itemId: string, updates: Partial<ConfirmDraft>) => {
    setConfirmDrafts((prev) => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        ...updates
      }
    }));
  };

  const handleDeletePlan = async (id: string) => {
    if (!confirm('Delete this weekly plan? This will restore requests to pending.')) {
      return;
    }
    setError('');
    setStatusMessage('');
    try {
      const response = await fetch(`/api/weekly-plans/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(token)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to delete weekly plan');
      }
      if (plan && plan._id === id) {
        setPlan(null);
        setItems([]);
        setPlanId('');
      }
      setStatusMessage('Weekly plan deleted.');
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete weekly plan');
    }
  };

  const handleItemChange = (id: string, updates: Partial<WeeklyPlanItem>) => {
    setItems((prev) =>
      prev.map((item) => (item._id === id ? { ...item, ...updates } : item))
    );
  };

  if (!canManage) {
    return (
      <div className="weekly-plan-container">
        <div className="error-message">You do not have access to Weekly Plans.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="weekly-plan-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading weekly plan...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="weekly-plan-container">
      <div className="weekly-plan-header">
        <div>
          <h1>Weekly Plan</h1>
          <p>Create and adjust the weekly transfusion schedule.</p>
        </div>
        <div className="weekly-plan-actions">
          <div className="field-inline">
            <label htmlFor="weekStart">Week of</label>
            <DateInput
              id="weekStart"
              value={weekStart}
              onChange={(value) => setWeekStart(value)}
            />
          </div>
          <button className="btn btn-primary" onClick={handleCreatePlan}>
            Create Plan
          </button>
        </div>
      </div>

      <div className="weekly-plan-load">
        <div className="field-inline">
          <label htmlFor="planId">Plan ID</label>
          <input
            id="planId"
            type="text"
            placeholder="Paste plan id"
            value={planId}
            onChange={(event) => setPlanId(event.target.value)}
          />
        </div>
        <button className="btn btn-secondary" onClick={handleLoadPlan}>
          Load Plan
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {statusMessage && <div className="success-message">{statusMessage}</div>}

      {plan && (
        <div className="weekly-plan-card">
          <div className="plan-meta">
            <div>
              <span className="label">Week</span>
              <span>{formatDisplayRange(plan.weekStart, plan.weekEnd, calendarMode)}</span>
            </div>
            <div>
              <span className="label">Status</span>
              <span className="status-pill">{plan.status}</span>
            </div>
          </div>
          <div className="table-scroll">
            <table className="weekly-plan-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Blood Group</th>
                  <th>Hospital</th>
                  <th>Date</th>
                  <th>Units</th>
                  <th>Notes</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const patient = patientMap.get(item.patientId);
                  const draft = confirmDrafts[item._id];
                  return (
                    <Fragment key={item._id}>
                      <tr key={item._id}>
                        <td>
                          <div className="patient-cell">
                            <span className="patient-name">{patient?.patient_name || 'Unknown'}</span>
                            <span className="patient-reg">{patient?.registered_no || item.patientId}</span>
                          </div>
                        </td>
                        <td>{patient?.blood_group || 'N/A'}</td>
                        <td>
                          <select
                            value={item.assignedHospital}
                            onChange={(event) =>
                              handleItemChange(item._id, { assignedHospital: event.target.value })
                            }
                          >
                            {hospitalOptions.map((hospital) => (
                              <option key={hospital} value={hospital}>
                                {hospital}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <DateInput
                            value={item.assignedDate?.slice(0, 10) || ''}
                            onChange={(value) => handleItemChange(item._id, { assignedDate: value })}
                          />
                        </td>
                        <td>
                          <select
                            value={item.assignedUnits}
                            onChange={(event) =>
                              handleItemChange(item._id, { assignedUnits: Number(event.target.value) })
                            }
                          >
                            <option value={1}>1</option>
                            <option value={2}>2</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            value={item.notes || ''}
                            onChange={(event) =>
                              handleItemChange(item._id, { notes: event.target.value })
                            }
                          />
                        </td>
                        <td className="status-pill">{item.status}</td>
                        <td className="row-actions">
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleSaveItem(item)}
                            disabled={savingItemId === item._id}
                          >
                            {savingItemId === item._id ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => toggleConfirmOpen(item._id)}
                          >
                            {draft?.open ? 'Hide Confirm' : 'Confirm'}
                          </button>
                        </td>
                      </tr>
                      {draft?.open && (
                        <tr className="confirm-row">
                          <td colSpan={8}>
                            <div className="confirm-panel" data-item-id={item._id}>
                              <div className="confirm-field">
                                <label>Actual Date</label>
                                <DateInput
                                  value={draft.actualDate}
                                  onChange={(value) =>
                                    updateConfirmDraft(item._id, { actualDate: value })
                                  }
                                />
                              </div>
                              <div className="confirm-field">
                                <label>Units</label>
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.unitsTransfused}
                                  onChange={(event) =>
                                    updateConfirmDraft(item._id, { unitsTransfused: Number(event.target.value) })
                                  }
                                />
                              </div>
                              <div className="confirm-field">
                                <label>Outcome</label>
                                <select
                                  value={draft.outcome}
                                  onChange={(event) =>
                                    updateConfirmDraft(item._id, { outcome: event.target.value })
                                  }
                                >
                                  <option value="completed">Completed</option>
                                  <option value="postponed">Postponed</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              </div>
                              <div className="confirm-field">
                                <label>Reason</label>
                                <input
                                  type="text"
                                  value={draft.reason}
                                  onChange={(event) =>
                                    updateConfirmDraft(item._id, { reason: event.target.value })
                                  }
                                />
                              </div>
                              <div className="confirm-field confirm-notes">
                                <label>Notes</label>
                                <input
                                  type="text"
                                  value={draft.notes}
                                  onChange={(event) =>
                                    updateConfirmDraft(item._id, { notes: event.target.value })
                                  }
                                />
                              </div>
                              <div className="confirm-actions">
                                <button
                                  className="btn btn-secondary"
                                  onClick={() => toggleConfirmOpen(item._id)}
                                >
                                  Cancel
                                </button>
                                <button
                                  className="btn btn-primary"
                                  onClick={() => handleConfirmTransfusion(item._id)}
                                  disabled={confirmingId === item._id}
                                >
                                  {confirmingId === item._id ? 'Saving...' : 'Confirm Transfusion'}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="weekly-plan-list">
        <div className="list-header">
          <h2>Previous Plans</h2>
          <button className="btn btn-secondary" onClick={loadPlans}>
            Refresh
          </button>
        </div>
        {plans.filter((entry) => entry._id !== plan?._id).length === 0 ? (
          <div className="empty-state">No plans created yet.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Status</th>
                  <th>Plan ID</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {plans
                  .filter((entry) => entry._id !== plan?._id)
                  .map((entry) => (
                    <tr key={entry._id}>
                      <td>{formatDisplayRange(entry.weekStart, entry.weekEnd, calendarMode)}</td>
                      <td className="status-pill">{entry.status}</td>
                      <td className="mono">{entry._id}</td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setPlanId(entry._id);
                            handleLoadPlan();
                          }}
                        >
                          Open
                        </button>
                        {isSuperAdmin && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeletePlan(entry._id)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
