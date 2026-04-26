import type { CalendarMode } from '../contexts/CalendarContext';

export const formatDisplayDate = (
  dateString: string | null | undefined,
  calendarMode: CalendarMode,
  options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }
) => {
  if (!dateString) return 'N/A';
  if (calendarMode === 'BS') {
    return dateString.slice(0, 10);
  }
  try {
    return new Date(dateString).toLocaleDateString('en-US', options);
  } catch {
    return dateString;
  }
};

export const formatDisplayRange = (
  start: string | null | undefined,
  end: string | null | undefined,
  calendarMode: CalendarMode
) => `${formatDisplayDate(start, calendarMode)} – ${formatDisplayDate(end, calendarMode)}`;
