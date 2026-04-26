import { useEffect, useState } from 'react';

import { WeeklyPlan, WeeklySummary } from '../types';
import { getAuthHeaders, useAuth } from '../contexts/AuthContext';
import { useCalendarMode } from '../contexts/CalendarContext';
import { formatDisplayRange } from '../utils/dateFormat';
import './WeeklySummary.css';

interface SummaryResponse {
  plan: WeeklyPlan;
  summary: WeeklySummary;
}

const LAST_PLAN_KEY = 'weekly_plan_last';

export function WeeklySummaryView() {
  const { token, user } = useAuth();
  const { calendarMode } = useCalendarMode();
  const canManage = user?.role === 'data_entry' || user?.role === 'super_admin';
  const [planId, setPlanId] = useState<string>('');
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [plans, setPlans] = useState<WeeklyPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem(LAST_PLAN_KEY);
    if (stored) {
      setPlanId(stored);
    }
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const response = await fetch('/api/weekly-plans?limit=50', {
        headers: getAuthHeaders(token),
      });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      setPlans(data.data?.plans || []);
    } catch {
      // ignore list failures
    }
  };

  const loadSummary = async (id?: string) => {
    const targetId = id || planId;
    if (!targetId) {
      setError('Enter a plan ID to load summary.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const response = await fetch(`/api/weekly-plans/${targetId}/summary`, {
        headers: getAuthHeaders(token),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to load summary');
      }
      const responseData = data.data as SummaryResponse;
      setPlan(responseData.plan);
      setSummary(responseData.summary);
      setPlanId(targetId);
      localStorage.setItem(LAST_PLAN_KEY, targetId);
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    } finally {
      setLoading(false);
    }
  };


  if (!canManage) {
    return (
      <div className="weekly-summary-container">
        <div className="error-message">You do not have access to Weekly Summary.</div>
      </div>
    );
  }

  return (
    <div className="weekly-summary-container">
      {!plan && (
        <div className="weekly-summary-header">
          <div>
            <h1>Weekly Summary</h1>
            <p>Select a plan to view its summary.</p>
          </div>
        </div>
      )}

      {error && <div className="error-message">{error}</div>}
      {successMessage && <div className="success-message">{successMessage}</div>}

      {!plan && (
        <div className="weekly-summary-list">
          <div className="list-header">
            <h2>Weekly Plans</h2>
            <button className="btn btn-secondary" onClick={loadPlans}>
              Refresh
            </button>
          </div>
          {plans.length === 0 ? (
            <div className="empty-state">No weekly plans found.</div>
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
                  {plans.map((entry) => (
                    <tr key={entry._id}>
                      <td>{formatDisplayRange(entry.weekStart, entry.weekEnd, calendarMode)}</td>
                      <td className="status-pill">{entry.status}</td>
                      <td className="mono">{entry._id}</td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            loadSummary(entry._id);
                          }}
                          disabled={loading}
                        >
                          {loading ? 'Loading...' : 'View Summary'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {plan && summary && (
        <>
          <div className="weekly-summary-header">
            <div>
              <h1>Weekly Summary</h1>
              <p>Review totals for the selected plan.</p>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setPlan(null);
                setSummary(null);
              }}
            >
              Back to Plans
            </button>
          </div>
          <div className="summary-card">
            <div className="summary-meta">
              <span>
                Week: {formatDisplayRange(plan.weekStart, plan.weekEnd, calendarMode)}
              </span>
              <span>Total Units: {summary.totalUnits}</span>
            </div>

            <div className="summary-grid">
              <div>
                <h3>By Blood Group</h3>
                <table>
                  <tbody>
                    {Object.entries(summary.byBloodGroup).map(([group, units]) => (
                      <tr key={group}>
                        <td>{group}</td>
                        <td>{units}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h3>By Hospital</h3>
                <table>
                  <tbody>
                    {Object.entries(summary.byHospital).map(([hospital, units]) => (
                      <tr key={hospital}>
                        <td>{hospital}</td>
                        <td>{units}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <h3>By Date</h3>
                <table>
                  <tbody>
                    {Object.entries(summary.byDate).map(([date, units]) => (
                      <tr key={date}>
                        <td>{date}</td>
                        <td>{units}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </>
      )}
    </div>
  );
}
