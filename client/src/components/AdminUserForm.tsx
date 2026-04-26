import { useState, type FormEvent } from 'react';

import { useAuth, getAuthHeaders } from '../contexts/AuthContext';
import './AdminUserForm.css';

const ROLES = [
  { value: 'data_entry', label: 'Data Entry' },
  { value: 'medical_reviewer', label: 'Medical Reviewer' },
  { value: 'analyst', label: 'Analyst' },
  { value: 'super_admin', label: 'Super Admin' }
];

export function AdminUserForm({ onDone }: { onDone: () => void }) {
  const { token } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('data_entry');
  const [tempPassword, setTempPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ email, name, role, tempPassword })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      setSuccess(`User created: ${data.user.email}`);
      setEmail('');
      setName('');
      setTempPassword('');
      setRole('data_entry');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="admin-user-form">
      <div className="admin-user-form__header">
        <h2>Create New User</h2>
        <button className="admin-user-form__back" onClick={onDone}>
          Back to Patients
        </button>
      </div>

      <form className="admin-user-form__card" onSubmit={handleSubmit}>
        <div className="admin-user-form__grid">
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="user@example.com"
            />
          </label>
          <label>
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Full name"
            />
          </label>
          <label>
            <span>Role</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>One-time Password</span>
            <input
              type="text"
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
              required
              placeholder="Temporary password"
            />
          </label>
        </div>

        {error && <div className="admin-user-form__error">{error}</div>}
        {success && <div className="admin-user-form__success">{success}</div>}

        <button className="admin-user-form__submit" type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create User'}
        </button>
      </form>
    </section>
  );
}
