import { useState, useEffect, type FormEvent } from 'react';

import { useAuth, getAuthHeaders } from '../contexts/AuthContext';
import './ChangePassword.css';

export function ChangePassword({ onDone }: { onDone: () => void }) {
  const { user, token, updateUser } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Auto-redirect if user no longer needs to change password
  useEffect(() => {
    if (user && !user.mustChangePassword) {
      // Small delay to ensure UI updates
      setTimeout(() => onDone(), 500);
    }
  }, [user, onDone]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }


      updateUser(data.user);

      // Force a small delay to ensure state update propagates
      setTimeout(() => {
        setSuccess('Password updated successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        onDone();
      }, 100);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="change-password">
      <div className="change-password__card">
        <h2>Change Password</h2>
        <p>Please set a new password to continue.</p>

        <form onSubmit={handleSubmit} className="change-password__form">
          <label>
            <span>Current Password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
          </label>
          <label>
            <span>New Password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          <label>
            <span>Confirm New Password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>

          {error && <div className="change-password__error">{error}</div>}
          {success && <div className="change-password__success">{success}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </section>
  );
}
