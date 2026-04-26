import { useState, useEffect, type MouseEvent } from 'react';

import { useAuth } from '../contexts/AuthContext';

import './Sidebar.css';

function Sidebar({
  onShowAdminUsers,
  onShowUsersList,
  onShowChangePassword,
  onShowSettings,
  onShowCalendarTest,
  onShowFridayRequests,
  onShowWeeklyPlan,
  onShowWeeklySummary,
  onShowTransfusionConfirmation,
  onShowReports,
  currentView,
  onNavigate
}: {
  onShowAdminUsers: () => void;
  onShowUsersList: () => void;
  onShowChangePassword: () => void;
  onShowSettings: () => void;
  onShowCalendarTest: () => void;
  onShowFridayRequests: () => void;
  onShowWeeklyPlan: () => void;
  onShowWeeklySummary: () => void;
  onShowTransfusionConfirmation: () => void;
  onShowReports: () => void;
  currentView: string;
  onNavigate: (view: string) => void;
}) {
  const { user, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isSuperAdmin = user?.role === 'super_admin';
  const canManageRequests = user?.role === 'data_entry' || user?.role === 'super_admin';
  const canViewReports = user?.role === 'analyst' || user?.role === 'super_admin';

  const closeMobileMenu = () => setIsMobileOpen(false);

  // Handle keyboard events for mobile menu
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isMobileOpen) {
        setIsMobileOpen(false);
      }
    };

    if (isMobileOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when mobile menu is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isMobileOpen]);

  const getNavItemClass = (view: string) => {
    return `sidebar-nav-item ${currentView === view ? 'active' : ''}`;
  };

  // Handle click outside to close mobile menu
  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Menu Toggle Button */}
      <button
        className={`mobile-menu-toggle ${isMobileOpen ? 'open' : ''}`}
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label="Toggle navigation menu"
        aria-expanded={isMobileOpen}
      >
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="mobile-overlay"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isMobileOpen ? 'open' : ''}`}>
      {/* Mobile Close Button */}
      <button
        className="sidebar-close-mobile"
        onClick={() => setIsMobileOpen(false)}
        aria-label="Close navigation menu"
      >
        ✕
      </button>

      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <span>PP</span>
          </div>
          <div className="logo-text">
            <span className="logo-title">Patient Portal</span>
            <span className="logo-subtitle">Blood Transfusion Portal</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {user && (
          <>
            {/* Dashboard/Home */}
            <button
              className={getNavItemClass('list')}
              onClick={() => {
                onNavigate('list');
                closeMobileMenu();
              }}
            >
              <span className="nav-icon">🏠</span>
              <span className="nav-text">Dashboard</span>
            </button>

            {/* Admin Only */}
            {isSuperAdmin && (
              <>
                <div className="nav-section">
                  <span className="nav-section-title">Administration</span>
                </div>
                <button
                  className={getNavItemClass('admin-users-list')}
                  onClick={() => {
                    onShowUsersList();
                    closeMobileMenu();
                  }}
                >
                  <span className="nav-icon">👥</span>
                  <span className="nav-text">Users</span>
                </button>
                <button
                  className={getNavItemClass('admin-users')}
                  onClick={() => {
                    onShowAdminUsers();
                    closeMobileMenu();
                  }}
                >
                  <span className="nav-icon">➕</span>
                  <span className="nav-text">Add User</span>
                </button>
                <button
                  className={getNavItemClass('settings')}
                  onClick={() => {
                    onShowSettings();
                    closeMobileMenu();
                  }}
                >
                  <span className="nav-icon">⚙️</span>
                  <span className="nav-text">Settings</span>
                </button>
                <button
                  className={getNavItemClass('calendar-test')}
                  onClick={() => {
                    onShowCalendarTest();
                    closeMobileMenu();
                  }}
                >
                  <span className="nav-icon">🗓️</span>
                  <span className="nav-text">BS Calendar Test</span>
                </button>
              </>
            )}

            {/* Request Management */}
            {canManageRequests && (
              <>
                <div className="nav-section">
                  <span className="nav-section-title">Blood Requests</span>
                </div>
                <button
                  className={getNavItemClass('friday-requests')}
                  onClick={() => {
                    onShowFridayRequests();
                    closeMobileMenu();
                  }}
                >
                  <span className="nav-icon">📅</span>
                  <span className="nav-text">Friday Requests</span>
                </button>
                <button
                  className={getNavItemClass('weekly-plan')}
                  onClick={() => {
                    onShowWeeklyPlan();
                    closeMobileMenu();
                  }}
                >
                  <span className="nav-icon">📋</span>
                  <span className="nav-text">Weekly Plan</span>
                </button>
                <button
                  className={getNavItemClass('weekly-summary')}
                  onClick={() => {
                    onShowWeeklySummary();
                    closeMobileMenu();
                  }}
                >
                  <span className="nav-icon">📊</span>
                  <span className="nav-text">Weekly Summary</span>
                </button>
                <button
                  className={getNavItemClass('transfusion-confirmation')}
                  onClick={() => {
                    onShowTransfusionConfirmation();
                    closeMobileMenu();
                  }}
                >
                  <span className="nav-icon">✅</span>
                  <span className="nav-text">Confirmation</span>
                </button>
              </>
            )}

            {/* Reports */}
            {canViewReports && (
              <>
                <div className="nav-section">
                  <span className="nav-section-title">Reports</span>
                </div>
                <button
                  className={getNavItemClass('reports')}
                  onClick={() => {
                    onShowReports();
                    closeMobileMenu();
                  }}
                >
                  <span className="nav-icon">📈</span>
                  <span className="nav-text">Analytics</span>
                </button>
              </>
            )}

            {/* User Actions */}
            <div className="nav-section">
              <span className="nav-section-title">Account</span>
            </div>
            <button
              className={getNavItemClass('change-password')}
              onClick={() => {
                onShowChangePassword();
                closeMobileMenu();
              }}
            >
              <span className="nav-icon">🔑</span>
              <span className="nav-text">Change Password</span>
            </button>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="user-info">
            <div className="user-details">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{user.role?.replace('_', ' ').toUpperCase()}</span>
            </div>
            <button className="logout-button" onClick={logout} title="Logout">
              <span className="logout-icon">🚪</span>
              <span className="logout-text">Logout</span>
            </button>
          </div>
        )}
      </div>
    </aside>
    </>
  );
}

export default Sidebar;
