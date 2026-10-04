import { createContext, useContext, useMemo } from 'react';
import { isWeekend, toIso } from './format.js';

// Offices with holiday calendars. The server keeps the same list; this copy is for the sign-up form.
export const OFFICES = ['Bengaluru', 'Chennai', 'Gurgaon', 'Hyderabad', 'Mumbai', 'Pune'];

const EMPTY = { weekendRequests: false, offices: OFFICES, holidays: [], office: null, reload: () => {} };

/** Feature flags and holidays from /api/workplace, plus the signed-in person's office. */
export const WorkplaceContext = createContext(EMPTY);

export function useWorkplace() {
  return useContext(WorkplaceContext);
}

/**
 * The work calendar for one office. With the comp-off and overtime pay flag on, the week is Monday
 * to Friday; with it off, all seven days are workdays. Holidays are never workdays.
 */
export function workCalendar(workplace, office) {
  const names = new Map();
  for (const h of workplace.holidays) {
    if (h.city && h.city !== office) continue;
    names.set(h.date, names.has(h.date) ? `${names.get(h.date)} · ${h.name}` : h.name);
  }
  const weekendsOff = Boolean(workplace.weekendRequests);
  const isWeekendOff = (iso) => weekendsOff && isWeekend(iso);
  const isOffDay = (iso) => isWeekendOff(iso) || names.has(iso);

  /** The days of the week that contains {@code iso}: Mon–Fri, or Mon–Sun for a 7-day week. */
  function weekDays(iso) {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return Array.from({ length: weekendsOff ? 5 : 7 }, (_, i) => {
      const day = new Date(d);
      day.setDate(d.getDate() + i);
      return toIso(day);
    });
  }

  return {
    weekendsOff,
    holiday: (iso) => names.get(iso) ?? null,
    isWeekendOff,
    isOffDay,
    weekDays,
    /** Workdays of that week (holidays left out). */
    workdays: (iso) => weekDays(iso).filter((d) => !names.has(d)),
    /** Workdays after {@code fromIso} and before {@code untilIso}: days someone could have logged but didn't. */
    missed(fromIso, untilIso) {
      let count = 0;
      const d = new Date(`${fromIso}T00:00:00`);
      d.setDate(d.getDate() + 1);
      while (toIso(d) < untilIso) {
        if (!isOffDay(toIso(d))) count += 1;
        d.setDate(d.getDate() + 1);
      }
      return count;
    },
    /** The next few holidays from {@code fromIso}, merged per day. */
    upcoming(fromIso, limit = 4) {
      return [...names.entries()]
        .filter(([date]) => date >= fromIso)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, limit)
        .map(([date, name]) => ({ date, name }));
    },
  };
}

/** The calendar for {@code office}; leave it out for the signed-in person's own office. */
export function useWorkCalendar(office) {
  const workplace = useWorkplace();
  const which = office === undefined ? workplace.office : office;
  return useMemo(() => workCalendar(workplace, which), [workplace, which]);
}
