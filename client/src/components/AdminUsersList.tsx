import { useEffect, useState } from 'react';

import { useAuth, getAuthHeaders } from '../contexts/AuthContext';
import './AdminUsersList.css';

interface AdminUser {
  _id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  created_at: string;
}

export function AdminUsersList({ onDone, onAddUser }: { onDone: () => void; onAddUser: () => void }) {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadUsers = async () => {
      try {
        const response = await fetch('/api/users', {
          headers: getAuthHeaders(token)
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch users');
        }

        if (active) {
          setUsers(data.users || []);
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

    loadUsers();
    return () => {
      active = false;
    };
  }, [token]);

  const handleDeactivate = async (userId: string) => {
    setActionLoading(userId);
    setError(null);
    try {
      const response = await fetch(`/api/users/${userId}/deactivate`, {
        method: 'PATCH',
        headers: getAuthHeaders(token)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to deactivate user');
      }

      setUsers((prev) =>
        prev.map((user) => (user._id === userId ? { ...user, isActive: false } : user))
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <section className="admin-users">
      <div className="admin-users__header">
        <div>
          <h2>Users</h2>
          <p>Manage all staff accounts.</p>
        </div>
        <div className="admin-users__actions">
          <button className="admin-users__button" onClick={onAddUser}>
            Add User
          </button>
          <button className="admin-users__button admin-users__button--ghost" onClick={onDone}>
            Back
          </button>
        </div>
      </div>

      {error && <div className="admin-users__error">{error}</div>}

      {loading ? (
        <div className="admin-users__loading">Loading users...</div>
      ) : (
        <div className="admin-users__table">
          <div className="admin-users__row admin-users__row--head">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span>Temp Password</span>
            <span>Actions</span>
          </div>
          {users.map((user) => (
            <div className="admin-users__row" key={user._id}>
              <span>{user.name}</span>
              <span className="admin-users__email">{user.email}</span>
              <span className="admin-users__role">{user.role.replace('_', ' ')}</span>
              <span className={user.isActive ? 'admin-users__status' : 'admin-users__status admin-users__status--inactive'}>
                {user.isActive ? 'Active' : 'Inactive'}
              </span>
              <span>{user.mustChangePassword ? 'Required' : '—'}</span>
              <span>
                <button
                  className="admin-users__action"
                  onClick={() => handleDeactivate(user._id)}
                  disabled={!user.isActive || actionLoading === user._id}
                >
                  {actionLoading === user._id ? 'Deactivating...' : 'Deactivate'}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
