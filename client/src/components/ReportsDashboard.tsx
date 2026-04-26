import { useState } from 'react';

import {
  ReportFrequencyRow,
  ReportHospitalRow,
  ReportPeakDayRow,
  ReportShortageRow
} from '../types';
import { getAuthHeaders, useAuth } from '../contexts/AuthContext';
import { useCalendarMode } from '../contexts/CalendarContext';
import { formatDisplayDate } from '../utils/dateFormat';
import './ReportsDashboard.css';

export function ReportsDashboard() {
  const { token, user } = useAuth();
  const { calendarMode } = useCalendarMode();
  const canView = user?.role === 'analyst' || user?.role === 'super_admin';
  const [frequency, setFrequency] = useState<ReportFrequencyRow[]>([]);
  const [shortage, setShortage] = useState<ReportShortageRow[]>([]);
  const [hospitalLoad, setHospitalLoad] = useState<ReportHospitalRow[]>([]);
  const [peakDays, setPeakDays] = useState<ReportPeakDayRow[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const loadReports = async () => {
    setLoading(true);
    setError('');
    try {
      const [freqRes, shortageRes, hospitalRes] = await Promise.all([
        fetch('/api/reports/transfusion-frequency', { headers: getAuthHeaders(token) }),
        fetch('/api/reports/shortage', { headers: getAuthHeaders(token) }),
        fetch('/api/reports/hospital-load', { headers: getAuthHeaders(token) })
      ]);

      if (!freqRes.ok || !shortageRes.ok || !hospitalRes.ok) {
        throw new Error('Failed to load reports');
      }

      const freqData = await freqRes.json();
      const shortageData = await shortageRes.json();
      const hospitalData = await hospitalRes.json();

      setFrequency(freqData.data?.results || []);
      setShortage(shortageData.data?.results || []);
      setHospitalLoad(hospitalData.data?.hospitalTotals || []);
      setPeakDays(hospitalData.data?.peakDays || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  if (!canView) {
    return (
      <div className="reports-container">
        <div className="error-message">You do not have access to Reports.</div>
      </div>
    );
  }

  return (
    <div className="reports-container">
      <div className="reports-header">
        <div>
          <h1>Reports & Analytics</h1>
          <p>Review transfusion frequency, shortages, and hospital load.</p>
        </div>
        <button className="btn btn-primary" onClick={loadReports} disabled={loading}>
          {loading ? 'Loading...' : 'Load Reports'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="reports-grid">
        <section>
          <h2>Transfusion Frequency</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Total Transfusions</th>
                  <th>Total Units</th>
                  <th>Last Date</th>
                  <th>Avg Interval</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {frequency.map((row) => (
                  <tr key={row.patientId}>
                    <td>
                      {row.patient_name ? `${row.patient_name} (${row.registered_no})` : row.patientId}
                    </td>
                    <td>{row.totalTransfusions}</td>
                    <td>{row.totalUnits}</td>
                    <td>{formatDisplayDate(row.lastTransfusionDate, calendarMode).replace('N/A', '—')}</td>
                    <td>{row.averageIntervalDays ? Math.round(row.averageIntervalDays) : '—'}</td>
                    <td>{row.frequencyCategory}</td>
                  </tr>
                ))}
                {frequency.length === 0 && (
                  <tr>
                    <td colSpan={6}>No data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2>Shortage Analysis</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Week Start</th>
                  <th>Requested</th>
                  <th>Transfused</th>
                  <th>Shortage</th>
                </tr>
              </thead>
              <tbody>
                {shortage.map((row) => (
                  <tr key={row.weekStart}>
                    <td>{formatDisplayDate(row.weekStart, calendarMode)}</td>
                    <td>{row.requestedUnits}</td>
                    <td>{row.transfusedUnits}</td>
                    <td>{row.shortageUnits}</td>
                  </tr>
                ))}
                {shortage.length === 0 && (
                  <tr>
                    <td colSpan={4}>No data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2>Hospital Load</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Hospital</th>
                  <th>Total Units</th>
                  <th>Transfusions</th>
                </tr>
              </thead>
              <tbody>
                {hospitalLoad.map((row) => (
                  <tr key={row.hospital}>
                    <td>{row.hospital}</td>
                    <td>{row.totalUnits}</td>
                    <td>{row.transfusionCount}</td>
                  </tr>
                ))}
                {hospitalLoad.length === 0 && (
                  <tr>
                    <td colSpan={3}>No data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <h3>Peak Load Days</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Total Units</th>
                </tr>
              </thead>
              <tbody>
                {peakDays.map((row) => (
                  <tr key={row.date}>
                    <td>{formatDisplayDate(row.date, calendarMode)}</td>
                    <td>{row.totalUnits}</td>
                  </tr>
                ))}
                {peakDays.length === 0 && (
                  <tr>
                    <td colSpan={2}>No data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
