import { useEffect, useState, type ChangeEvent } from 'react';
import { DatePicker } from 'react-nepali-datetime-picker';

import { useCalendarMode } from '../contexts/CalendarContext';

type DateInputProps = {
  id?: string;
  name?: string;
  value: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  onChange: (value: string) => void;
};

export function DateInput({
  id,
  name,
  value,
  required,
  disabled,
  min,
  max,
  className,
  onChange
}: DateInputProps) {
  const { calendarMode } = useCalendarMode();
  const [bsDisplay, setBsDisplay] = useState('');

  useEffect(() => {
    if (calendarMode !== 'BS') return;
    setBsDisplay(value || '');
  }, [calendarMode, value]);

  if (calendarMode === 'BS') {
    const formatBs = (value: any) => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      const normalizeDigits = (raw: unknown) => {
        if (raw === undefined || raw === null) return '';
        if (typeof raw === 'number') return String(raw);
        return String(raw).replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)));
      };
      const extractNumber = (raw: any): number | null => {
        if (raw === undefined || raw === null) return null;
        if (typeof raw === 'number') return raw;
        if (typeof raw === 'string') {
          const normalized = normalizeDigits(raw);
          const parsed = Number(normalized);
          return Number.isNaN(parsed) ? null : parsed;
        }
        if (typeof raw === 'object') {
          if ('value' in raw) return extractNumber(raw.value);
          if ('year' in raw) return extractNumber(raw.year);
          if ('month' in raw) return extractNumber(raw.month);
          if ('day' in raw) return extractNumber(raw.day);
          if ('date' in raw) return extractNumber(raw.date);
          if ('id' in raw) return extractNumber(raw.id);
        }
        return null;
      };

      const yearRaw = value?.date?.year ?? value?.year;
      const monthRaw = value?.date?.month ?? value?.month;
      const dayRaw = value?.date?.day ?? value?.day ?? value?.date?.date ?? value?.date;

      const year = extractNumber(yearRaw);
      const monthValue = extractNumber(monthRaw);
      const day = extractNumber(dayRaw);
      if (year === null || monthValue === null || day === null) return '';
      if (Number.isNaN(year) || Number.isNaN(monthValue) || Number.isNaN(day)) return '';
      const monthNumber = monthValue <= 11 ? monthValue + 1 : monthValue;
      const pad = (num: number) => String(num).padStart(2, '0');
      return `${year}-${pad(monthNumber)}-${pad(day)}`;
    };

    const handleBsSelect = (value: any) => {
      const bsDate = formatBs(value);
      setBsDisplay(bsDate || '');
      onChange(bsDate);
    };

    const handleManualChange = (event: ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      setBsDisplay(next);
      onChange(next);
    };

    return (
      <DatePicker
        lang="en"
        onDateSelect={handleBsSelect}
        dateInput={{
          fullWidth: true,
          id,
          name,
          defaultValue: bsDisplay,
          required,
          disabled,
          min,
          max,
          className,
          onChange: handleManualChange,
          onBlur: handleManualChange
        }}
      />
    );
  }

  return (
    <input
      id={id}
      name={name}
      type="date"
      value={value}
      required={required}
      disabled={disabled}
      min={min}
      max={max}
      className={className}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
