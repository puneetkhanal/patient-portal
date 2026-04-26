import { useAuth } from '../contexts/AuthContext';
import './Header.css';

function Header({
  onShowAdminUsers,
  onShowUsersList,
  onShowChangePassword,
  onShowSettings,
  onShowFridayRequests,
  onShowWeeklyPlan,
  onShowWeeklySummary,
  onShowTransfusionConfirmation,
  onShowReports
}: {
  onShowAdminUsers: () => void;
  onShowUsersList: () => void;
  onShowChangePassword: () => void;
  onShowSettings: () => void;
  onShowFridayRequests: () => void;
  onShowWeeklyPlan: () => void;
  onShowWeeklySummary: () => void;
  onShowTransfusionConfirmation: () => void;
  onShowReports: () => void;
}) {
  const { user, logout } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';
  const canManageRequests = user?.role === 'data_entry' || user?.role === 'super_admin';
  const canViewReports = user?.role === 'analyst' || user?.role === 'super_admin';

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <div className="logo-icon">
            <span>PP</span>
          </div>
          <span className="logo-text">Patient Portal</span>
        </div>
        
        <div className="header-right">
          {user && (
            <div className="nav">
              {isSuperAdmin && (
                <>
                  <button className="nav-link" onClick={onShowUsersList}>
                    Users
                  </button>
                  <button className="nav-link" onClick={onShowAdminUsers}>
                    Add User
                  </button>
                  <button className="nav-link" onClick={onShowSettings}>
                    Settings
                  </button>
                </>
              )}
              {canManageRequests && (
                <>
                  <button className="nav-link" onClick={onShowFridayRequests}>
                    Friday Requests
                  </button>
                  <button className="nav-link" onClick={onShowWeeklyPlan}>
                    Weekly Plan
                  </button>
                  <button className="nav-link" onClick={onShowWeeklySummary}>
                    Weekly Summary
                  </button>
                  <button className="nav-link" onClick={onShowTransfusionConfirmation}>
                    Confirmation
                  </button>
                </>
              )}
              {canViewReports && (
                <button className="nav-link" onClick={onShowReports}>
                  Reports
                </button>
              )}
              <button className="nav-link" onClick={onShowChangePassword}>
                Change Password
              </button>
            </div>
          )}
          {user && (
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <button className="logout-button" onClick={logout} title="Logout">
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
