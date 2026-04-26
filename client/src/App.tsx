import { useState } from 'react';

import { Patient } from './types';
import Sidebar from './components/Sidebar';
import { Login } from './components/Login';
import { AdminUserForm } from './components/AdminUserForm';
import { AdminUsersList } from './components/AdminUsersList';
import { ChangePassword } from './components/ChangePassword';
import { PatientsList } from './components/PatientsList';
import { PatientRegistrationForm } from './components/PatientRegistrationForm';
import { PatientDetail } from './components/PatientDetail';
import { SettingsForm } from './components/SettingsForm';
import { FridayRequests } from './components/FridayRequests';
import { WeeklyPlanView } from './components/WeeklyPlan';
import { WeeklySummaryView } from './components/WeeklySummary';
import { TransfusionConfirmation } from './components/TransfusionConfirmation';
import { ReportsDashboard } from './components/ReportsDashboard';
import { CalendarTest } from './components/CalendarTest';
import { useAuth } from './contexts/AuthContext';
import { CalendarProvider } from './contexts/CalendarContext';
import './App.css';

type View =
  | 'list'
  | 'form'
  | 'edit'
  | 'detail'
  | 'admin-users'
  | 'admin-users-list'
  | 'change-password'
  | 'settings'
  | 'friday-requests'
  | 'weekly-plan'
  | 'weekly-summary'
  | 'transfusion-confirmation'
  | 'reports'
  | 'calendar-test';

function App() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [currentView, setCurrentView] = useState<View>('list');
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const handleAddNew = () => {
    setEditingPatient(null);
    setCurrentView('form');
  };

  const handleEdit = (patient: Patient) => {
    setEditingPatient(patient);
    setCurrentView('edit');
  };

  const handleView = (patient: Patient) => {
    setSelectedPatientId((patient.id || patient._id) as string);
    setCurrentView('detail');
  };

  const handleFormSuccess = () => {
    setCurrentView('list');
    setEditingPatient(null);
  };

  const handleFormCancel = () => {
    setCurrentView('list');
    setEditingPatient(null);
  };

  // Show login if not authenticated
  if (!authLoading && !isAuthenticated) {
    return <Login />;
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="app">
        <div className="loading-state" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  const showChangePassword = !!user?.mustChangePassword;

  return (
    <div className="app">
      <div className="background-effects">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
        <div className="grid-overlay"></div>
      </div>

      <CalendarProvider>
        <Sidebar
          onShowAdminUsers={() => setCurrentView('admin-users')}
          onShowUsersList={() => setCurrentView('admin-users-list')}
          onShowChangePassword={() => setCurrentView('change-password')}
          onShowSettings={() => setCurrentView('settings')}
          onShowCalendarTest={() => setCurrentView('calendar-test')}
          onShowFridayRequests={() => setCurrentView('friday-requests')}
          onShowWeeklyPlan={() => setCurrentView('weekly-plan')}
          onShowWeeklySummary={() => setCurrentView('weekly-summary')}
          onShowTransfusionConfirmation={() => setCurrentView('transfusion-confirmation')}
          onShowReports={() => setCurrentView('reports')}
          currentView={currentView}
          onNavigate={(view) => setCurrentView(view as View)}
        />
        
        <main className="main-content">
          {showChangePassword && (
            <ChangePassword onDone={() => setCurrentView('list')} />
          )}

          {!showChangePassword && currentView === 'admin-users' && (
            <AdminUserForm onDone={() => setCurrentView('list')} />
          )}

          {!showChangePassword && currentView === 'admin-users-list' && (
            <AdminUsersList
              onDone={() => setCurrentView('list')}
              onAddUser={() => setCurrentView('admin-users')}
            />
          )}

          {!showChangePassword && currentView === 'settings' && (
            <SettingsForm onDone={() => setCurrentView('list')} />
          )}

          {!showChangePassword && currentView === 'calendar-test' && (
            <CalendarTest />
          )}

          {!showChangePassword && currentView === 'friday-requests' && (
            <FridayRequests />
          )}

          {!showChangePassword && currentView === 'weekly-plan' && (
            <WeeklyPlanView />
          )}

          {!showChangePassword && currentView === 'weekly-summary' && (
            <WeeklySummaryView />
          )}

          {!showChangePassword && currentView === 'transfusion-confirmation' && (
            <TransfusionConfirmation />
          )}

          {!showChangePassword && currentView === 'reports' && (
            <ReportsDashboard />
          )}

          {!showChangePassword && currentView === 'list' && (
            <PatientsList
              onAddNew={handleAddNew}
              onEdit={handleEdit}
              onView={handleView}
            />
          )}
          
          {!showChangePassword && (currentView === 'form' || currentView === 'edit') && (
            <PatientRegistrationForm
              patient={editingPatient}
              onCancel={handleFormCancel}
              onSuccess={handleFormSuccess}
            />
          )}

          {!showChangePassword && currentView === 'detail' && selectedPatientId && (
            <PatientDetail
              patientId={selectedPatientId}
              onBack={() => setCurrentView('list')}
              onEdit={handleEdit}
              canEdit={user?.role === 'super_admin'}
            />
          )}

          {!showChangePassword && currentView === 'change-password' && (
            <ChangePassword onDone={() => setCurrentView('list')} />
          )}
        </main>
      </CalendarProvider>
    </div>
  );
}

export default App;
