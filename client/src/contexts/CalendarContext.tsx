import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuth } from './AuthContext';

export type CalendarMode = 'AD' | 'BS';

type CalendarContextValue = {
  calendarMode: CalendarMode;
  setCalendarMode: (mode: CalendarMode) => void;
  refreshCalendarMode: () => Promise<void>;
  loading: boolean;
};

const CalendarContext = createContext<CalendarContextValue | undefined>(undefined);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('BS');
  const [loading, setLoading] = useState(false);

  const refreshCalendarMode = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // BS-only UI: keep calendar mode fixed to BS.
      setCalendarMode('BS');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshCalendarMode();
  }, [refreshCalendarMode]);

  const value = useMemo(
    () => ({
      calendarMode,
      setCalendarMode,
      refreshCalendarMode,
      loading
    }),
    [calendarMode, refreshCalendarMode, loading]
  );

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>;
}

export function useCalendarMode() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendarMode must be used within CalendarProvider');
  }
  return context;
}
