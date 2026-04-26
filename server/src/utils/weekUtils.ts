const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getPartsInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long'
  });
  const parts = formatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }
  return {
    year: Number(partMap.year),
    month: Number(partMap.month),
    day: Number(partMap.day),
    weekday: partMap.weekday
  };
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const parts = formatter.formatToParts(date);
  const zone = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT+0';
  const match = zone.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;
  const sign = match[1].startsWith('-') ? -1 : 1;
  const hours = Math.abs(Number(match[1]));
  const minutes = match[2] ? Number(match[2]) : 0;
  return sign * (hours * 60 + minutes);
}

function getZonedMidnight(date: Date, timeZone: string): Date {
  const parts = getPartsInTimeZone(date, timeZone);
  const utcMidnight = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0));
  const offset = getTimeZoneOffsetMinutes(utcMidnight, timeZone);
  return new Date(utcMidnight.getTime() - offset * 60000);
}

export function getZonedWeekday(date: Date, timeZone: string): string {
  return getPartsInTimeZone(date, timeZone).weekday;
}

export function formatDateInTimeZone(date: Date, timeZone: string): string {
  const parts = getPartsInTimeZone(date, timeZone);
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
}

export function parseDateInTimeZone(dateStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) {
    return new Date('invalid');
  }
  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  const offset = getTimeZoneOffsetMinutes(utcNoon, timeZone);
  return new Date(utcNoon.getTime() - offset * 60000);
}

export function getWeekRange(date: Date, weekStartDay: string, timeZone: string) {
  const startIndex = WEEK_DAYS.indexOf(weekStartDay);
  const weekday = getZonedWeekday(date, timeZone);
  const currentIndex = WEEK_DAYS.indexOf(weekday);
  const diffDays = (7 + currentIndex - startIndex) % 7;

  const zonedMidnight = getZonedMidnight(date, timeZone);
  const weekStart = new Date(zonedMidnight);
  weekStart.setUTCDate(weekStart.getUTCDate() - diffDays);
  weekStart.setUTCHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);

  return { weekStart, weekEnd };
}
