import { useEffect, useRef, useState } from 'react';
import { formatDate, toIso } from '../format.js';
import Icon from './Icon.jsx';
import { useWorkCalendar } from '../workplace.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Month calendar. Weeks start on Monday. Office holidays are highlighted (for {@code office}, or the
 * signed-in person's office), and Saturday and Sunday are shaded when the work week is Monday to
 * Friday. {@code marks} maps an ISO date to a dot style ("logged").
 */
export function Calendar({ value, onChange, min, max, marks = {}, disabled, office }) {
  const work = useWorkCalendar(office);
  const [month, setMonth] = useState(() => (value || (min && min > toIso(new Date()) ? min : toIso(new Date()))).slice(0, 7));
  useEffect(() => {
    if (value) setMonth(value.slice(0, 7));
  }, [value]);

  const first = new Date(`${month}-01T00:00:00`);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < lead; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  const today = toIso(new Date());

  function shift(delta) {
    const d = new Date(first);
    d.setMonth(d.getMonth() + delta);
    setMonth(toIso(d).slice(0, 7));
  }

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button type="button" className="icon-btn" onClick={() => shift(-1)} aria-label="Previous month">
          <Icon name="chevronLeft" />
        </button>
        <strong>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <button type="button" className="icon-btn" onClick={() => shift(1)} aria-label="Next month">
          <Icon name="chevronRight" />
        </button>
      </div>
      <div className="calendar-grid" role="grid">
        {WEEKDAYS.map((w, i) => (
          <span key={w} className={`calendar-weekday ${i > 4 && work.weekendsOff ? 'is-weekend' : ''}`}>
            {w}
          </span>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <span key={`blank-${i}`} />;
          const off = (min && iso < min) || (max && iso > max) || (disabled && disabled(iso));
          const weekend = work.isWeekendOff(iso);
          const holiday = work.holiday(iso);
          return (
            <button
              key={iso}
              type="button"
              disabled={off}
              className={[
                'calendar-day',
                weekend && 'is-weekend',
                holiday && 'is-holiday',
                iso === today && 'is-today',
                iso === value && 'is-selected',
                marks[iso] && `mark-${marks[iso]}`,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onChange(iso)}
              aria-pressed={iso === value}
              title={holiday ?? undefined}
              aria-label={formatDate(iso, { weekday: 'long', month: 'long', day: 'numeric' }) + (holiday ? `, holiday: ${holiday}` : '')}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A date field that opens the calendar in a small popover. */
export function DatePicker({ value, onChange, min, max, disabled, label = 'Date', marks, office }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="datepicker" ref={ref}>
      <span className="field-label">{label}</span>
      <button type="button" className="datepicker-button" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon name="calendar" />
        {value ? formatDate(value, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : 'Pick a date'}
      </button>
      {open && (
        <div className="datepicker-pop">
          <Calendar
            value={value}
            min={min}
            max={max}
            disabled={disabled}
            marks={marks}
            office={office}
            onChange={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
