import { useEffect, useState, type FormEvent } from 'react';

import { useAuth, getAuthHeaders } from '../contexts/AuthContext';
import './SettingsForm.css';

type EmailRecipient = {
  name: string;
  email: string;
  active: boolean;
};

type Settings = {
  weekStartDay: string;
  weekTimeZone: string;
  calendarMode: 'AD' | 'BS';
  allowBackEntry: boolean;
  backEntryWarningDays: number;
  hospitalList: string[];
  hospitalCapacities: Array<{ name: string; slots: Record<string, number> }>;
  bloodGroups: string[];
  emailRecipients: EmailRecipient[];
};

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function SettingsForm({ onDone }: { onDone: () => void }) {
  const { token } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/settings', {
          headers: getAuthHeaders(token)
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || 'Failed to load settings');
        }
        const nextSettings = data.data.settings as Settings;
        setSettings(
          normalizeCapacities({
            ...nextSettings,
            calendarMode: 'BS'
          })
        );
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [token]);

  const normalizeCapacities = (nextSettings: Settings): Settings => {
    const map = new Map<string, { name: string; slots: Record<string, number> }>();
    (nextSettings.hospitalCapacities || []).forEach((entry) => {
      if (entry?.name) {
        map.set(entry.name, entry);
      }
    });
    const normalized = (nextSettings.hospitalList || []).map((hospital) => {
      const existing = map.get(hospital);
      const slots: Record<string, number> = {};
      WEEK_DAYS.forEach((day) => {
        const value = existing?.slots?.[day];
        const numeric = Number(value);
        slots[day] = Number.isFinite(numeric) ? numeric : 0;
      });
      return { name: hospital, slots };
    });
    return { ...nextSettings, hospitalCapacities: normalized };
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: getAuthHeaders(token),
        body: JSON.stringify(settings)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to save settings');
      }
      const nextSettings = data.data.settings as Settings;
      setSettings({ ...nextSettings, calendarMode: 'BS' });
      setSuccess('Settings saved successfully.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const updateRecipients = (next: EmailRecipient[]) => {
    if (!settings) return;
    setSettings({ ...settings, emailRecipients: next });
  };

  if (loading || !settings) {
    return (
      <section className="settings-form">
        <div className="settings-form__header">
          <h2>System Settings</h2>
          <button className="settings-form__back" onClick={onDone}>
            Back to Patients
          </button>
        </div>
        <div className="settings-form__card">Loading settings...</div>
      </section>
    );
  }

  return (
    <section className="settings-form">
      <div className="settings-form__header">
        <h2>System Settings</h2>
        <button className="settings-form__back" onClick={onDone}>
          Back to Patients
        </button>
      </div>

      <form className="settings-form__card" onSubmit={handleSave}>
        <div className="settings-form__grid">
          <label>
            <span>Week Start Day</span>
            <select
              value={settings.weekStartDay}
              onChange={(e) => setSettings({ ...settings, weekStartDay: e.target.value })}
            >
              {WEEK_DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Week Time Zone</span>
            <input
              type="text"
              value={settings.weekTimeZone}
              onChange={(e) => setSettings({ ...settings, weekTimeZone: e.target.value })}
            />
          </label>
          <label className="settings-form__checkbox">
            <input
              type="checkbox"
              checked={settings.allowBackEntry}
              onChange={(e) => setSettings({ ...settings, allowBackEntry: e.target.checked })}
            />
            <span>Allow Back-Entry for Friday Calls</span>
          </label>
          <label>
            <span>Back-Entry Warning Days</span>
            <input
              type="number"
              min={0}
              value={settings.backEntryWarningDays}
              onChange={(e) =>
                setSettings({ ...settings, backEntryWarningDays: Number(e.target.value) })
              }
            />
          </label>
          <label className="settings-form__full">
            <span>Hospitals (one per line)</span>
            <textarea
              rows={4}
              value={settings.hospitalList.join('\n')}
              onChange={(e) =>
                setSettings(
                  normalizeCapacities({
                    ...settings,
                    hospitalList: e.target.value.split('\n').filter(Boolean)
                  })
                )
              }
            />
          </label>
          <div className="settings-form__full settings-form__capacity">
            <div className="settings-form__section-title">Hospital Bed Capacity (per day)</div>
            <div className="settings-form__capacity-note">
              Set the number of transfusion slots available each day for each hospital.
            </div>
            <div className="settings-form__capacity-table">
              <div className="settings-form__capacity-row settings-form__capacity-header">
                <span>Hospital</span>
                {WEEK_DAYS.map((day) => (
                  <span key={day}>{day.slice(0, 3)}</span>
                ))}
              </div>
              {settings.hospitalCapacities.map((entry, index) => (
                <div className="settings-form__capacity-row" key={entry.name}>
                  <span className="settings-form__capacity-name">{entry.name}</span>
                  {WEEK_DAYS.map((day) => (
                    <input
                      key={`${entry.name}-${day}`}
                      type="number"
                      min={0}
                      value={entry.slots?.[day] ?? 0}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        const next = [...settings.hospitalCapacities];
                        const slots = { ...next[index].slots, [day]: Number.isFinite(value) ? value : 0 };
                        next[index] = { ...next[index], slots };
                        setSettings({ ...settings, hospitalCapacities: next });
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <label className="settings-form__full">
            <span>Blood Groups (one per line)</span>
            <textarea
              rows={3}
              value={settings.bloodGroups.join('\n')}
              onChange={(e) =>
                setSettings({ ...settings, bloodGroups: e.target.value.split('\n').filter(Boolean) })
              }
            />
          </label>
        </div>

        <div className="settings-form__recipients">
          <div className="settings-form__section-title">Email Recipients</div>
          {settings.emailRecipients.map((recipient, index) => (
            <div className="settings-form__recipient" key={`${recipient.email}-${index}`}>
              <input
                type="text"
                placeholder="Name"
                value={recipient.name}
                onChange={(e) => {
                  const next = [...settings.emailRecipients];
                  next[index] = { ...recipient, name: e.target.value };
                  updateRecipients(next);
                }}
              />
              <input
                type="email"
                placeholder="Email"
                value={recipient.email}
                onChange={(e) => {
                  const next = [...settings.emailRecipients];
                  next[index] = { ...recipient, email: e.target.value };
                  updateRecipients(next);
                }}
              />
              <label className="settings-form__checkbox">
                <input
                  type="checkbox"
                  checked={recipient.active}
                  onChange={(e) => {
                    const next = [...settings.emailRecipients];
                    next[index] = { ...recipient, active: e.target.checked };
                    updateRecipients(next);
                  }}
                />
                <span>Active</span>
              </label>
              <button
                type="button"
                className="settings-form__remove"
                onClick={() => {
                  const next = settings.emailRecipients.filter((_, i) => i !== index);
                  updateRecipients(next);
                }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="settings-form__add"
            onClick={() =>
              updateRecipients([
                ...settings.emailRecipients,
                { name: '', email: '', active: true }
              ])
            }
          >
            Add Recipient
          </button>
        </div>

        {error && <div className="settings-form__error">{error}</div>}
        {success && <div className="settings-form__success">{success}</div>}

        <button className="settings-form__submit" type="submit" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </section>
  );
}
