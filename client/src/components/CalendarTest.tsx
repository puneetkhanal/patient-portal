import { useState } from 'react';
import { DatePicker } from 'react-nepali-datetime-picker';

import './CalendarTest.css';

export function CalendarTest() {
  const [date, setDate] = useState('');
  const [lang, setLang] = useState<'ne' | 'en'>('en');

  const toEnglishDigits = (value: string) =>
    value.replace(/[०-९]/g, (digit) => String('०१२३४५६७८९'.indexOf(digit)));

  const formatBs = (value: any) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    const year = value.year ?? value?.date?.year;
    const monthRaw =
      value?.month?.value ??
      value?.month ??
      value?.date?.month?.value ??
      value?.date?.month;
    const day = value.day ?? value?.date?.day;
    if (!year || !monthRaw || !day) return '';
    const monthNumber = monthRaw <= 11 ? monthRaw + 1 : monthRaw;
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${year}-${pad(monthNumber)}-${pad(day)}`;
  };

  return (
    <div className="calendar-test">
      <div className="calendar-test__header">
        <div>
          <h1>BS Calendar Test</h1>
          <p>Testing page for BS date picker components.</p>
        </div>
      </div>

      <div className="calendar-test__controls">
        <label htmlFor="calendar-lang">Language</label>
        <select
          id="calendar-lang"
          value={lang}
          onChange={(event) => setLang(event.target.value as 'ne' | 'en')}
        >
          <option value="ne">BS</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className="calendar-test__grid">
        <div className="calendar-test__card">
          <label>Date Picker</label>
          <DatePicker
            lang={lang}
            onDateSelect={(value: any) => setDate(toEnglishDigits(formatBs(value)))}
            dateInput={{ fullWidth: true }}
          />
          <div className="calendar-test__value">Value: {date || '—'}</div>
        </div>
      </div>
    </div>
  );
}
