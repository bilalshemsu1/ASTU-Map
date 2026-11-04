import { Building, FacilitySchedule } from '../types/map';

export type OperatingStatus = 'open' | 'closing_soon' | 'lunch_break' | 'closed' | 'open_24_7';

export interface OperatingHoursStatus {
  status: OperatingStatus;
  badgeLabel: string;
  badgeDetail: string;
  statusDetail: string;
  badgeBg: string;
  badgeText: string;
  badgeColor: string;
  dotColor: string;
  scheduleSummary: string;
  schedule?: FacilitySchedule;
}

/**
 * Parses "HH:mm" time string into total minutes since midnight (0 - 1439).
 */
function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours * 60 + minutes;
}

/**
 * Formats "HH:mm" 24h string into friendly 12h time ("10:00 PM").
 */
export function formatTime12h(timeStr?: string): string {
  if (!timeStr) return '';
  const mins = parseTimeToMinutes(timeStr);
  if (mins === null) return timeStr;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${period}`;
}

/**
 * Evaluates real-time operating hours status of any campus facility.
 * Respects day of week, lunch breaks, and 24/7 exceptions.
 */
export function getFacilityOperatingStatus(
  building: Building,
  customDate?: Date
): OperatingHoursStatus {
  const schedule = building.details?.operatingHours;
  const hoursText = building.details?.hours;

  const wrap = (res: {
    status: OperatingStatus;
    badgeLabel: string;
    badgeDetail: string;
    badgeBg: string;
    badgeText: string;
    dotColor: string;
    scheduleSummary: string;
  }): OperatingHoursStatus => ({
    ...res,
    statusDetail: res.badgeDetail,
    badgeColor: res.badgeText,
    schedule,
  });

  // Default fallback if no structured hours exist
  if (!schedule) {
    if (hoursText) {
      return wrap({
        status: 'open',
        badgeLabel: 'Schedule',
        badgeDetail: hoursText,
        badgeBg: 'bg-emerald-500/15 border-emerald-400/30',
        badgeText: 'text-emerald-700',
        dotColor: 'bg-emerald-500',
        scheduleSummary: hoursText,
      });
    }

    return wrap({
      status: 'open',
      badgeLabel: 'Open',
      badgeDetail: 'Normal campus hours',
      badgeBg: 'bg-emerald-500/15 border-emerald-400/30',
      badgeText: 'text-emerald-700',
      dotColor: 'bg-emerald-500',
      scheduleSummary: 'Mon - Fri • 8:00 AM – 6:00 PM',
    });
  }

  // 24/7 facilities (e.g. Clinic, Emergency, Dorm gates)
  if (schedule.is24x7) {
    return wrap({
      status: 'open_24_7',
      badgeLabel: 'Open 24/7',
      badgeDetail: 'Always accessible',
      badgeBg: 'bg-emerald-500/15 border-emerald-400/30',
      badgeText: 'text-emerald-700',
      dotColor: 'bg-emerald-500',
      scheduleSummary: 'Open 24 Hours • 7 Days a week',
    });
  }

  const now = customDate || new Date();
  const dayOfWeek = now.getDay(); // 0 is Sunday, 6 is Saturday
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Weekend check: default weekday only unless schedule specifies "Daily" or "Sat"
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const allowsWeekend = schedule.days?.toLowerCase().includes('daily') ||
    schedule.days?.toLowerCase().includes('sat') ||
    schedule.days?.toLowerCase().includes('sun') ||
    (dayOfWeek === 6 && schedule.days?.toLowerCase().includes('sat'));

  const scheduleSummary = schedule.open && schedule.close
    ? `${schedule.days || 'Mon - Fri'} • ${formatTime12h(schedule.open)} – ${formatTime12h(schedule.close)}`
    : building.details?.hours || 'Standard Campus Schedule';

  if (isWeekend && !allowsWeekend) {
    return wrap({
      status: 'closed',
      badgeLabel: 'Closed',
      badgeDetail: 'Opens Monday at ' + (formatTime12h(schedule.open) || '8:00 AM'),
      badgeBg: 'bg-rose-500/15 border-rose-400/30',
      badgeText: 'text-rose-700',
      dotColor: 'bg-rose-500',
      scheduleSummary,
    });
  }

  const openMins = parseTimeToMinutes(schedule.open);
  const closeMins = parseTimeToMinutes(schedule.close);

  if (openMins === null || closeMins === null) {
    return wrap({
      status: 'open',
      badgeLabel: 'Open',
      badgeDetail: 'Campus Hours',
      badgeBg: 'bg-emerald-500/15 border-emerald-400/30',
      badgeText: 'text-emerald-700',
      dotColor: 'bg-emerald-500',
      scheduleSummary,
    });
  }

  // Check Lunch Break
  if (schedule.lunchStart && schedule.lunchEnd) {
    const lunchStartMins = parseTimeToMinutes(schedule.lunchStart);
    const lunchEndMins = parseTimeToMinutes(schedule.lunchEnd);
    if (lunchStartMins !== null && lunchEndMins !== null) {
      if (currentMinutes >= lunchStartMins && currentMinutes < lunchEndMins) {
        return wrap({
          status: 'lunch_break',
          badgeLabel: 'Lunch Break',
          badgeDetail: `Resumes at ${formatTime12h(schedule.lunchEnd)}`,
          badgeBg: 'bg-amber-500/15 border-amber-400/30',
          badgeText: 'text-amber-700',
          dotColor: 'bg-amber-500',
          scheduleSummary,
        });
      }
    }
  }

  // Before Opening
  if (currentMinutes < openMins) {
    return wrap({
      status: 'closed',
      badgeLabel: 'Closed',
      badgeDetail: `Opens today at ${formatTime12h(schedule.open)}`,
      badgeBg: 'bg-rose-500/15 border-rose-400/30',
      badgeText: 'text-rose-700',
      dotColor: 'bg-rose-500',
      scheduleSummary,
    });
  }

  // After Closing
  if (currentMinutes >= closeMins) {
    const nextDay = dayOfWeek === 5 ? 'Monday' : 'tomorrow';
    return wrap({
      status: 'closed',
      badgeLabel: 'Closed',
      badgeDetail: `Opens ${nextDay} at ${formatTime12h(schedule.open)}`,
      badgeBg: 'bg-rose-500/15 border-rose-400/30',
      badgeText: 'text-rose-700',
      dotColor: 'bg-rose-500',
      scheduleSummary,
    });
  }

  // Closing soon (within 45 minutes)
  const minutesUntilClose = closeMins - currentMinutes;
  if (minutesUntilClose <= 45 && minutesUntilClose > 0) {
    return wrap({
      status: 'closing_soon',
      badgeLabel: 'Closing Soon',
      badgeDetail: `Closes in ${minutesUntilClose} min (${formatTime12h(schedule.close)})`,
      badgeBg: 'bg-amber-500/15 border-amber-400/30',
      badgeText: 'text-amber-700',
      dotColor: 'bg-amber-500',
      scheduleSummary,
    });
  }

  // Open Now
  return wrap({
    status: 'open',
    badgeLabel: 'Open Now',
    badgeDetail: `Closes at ${formatTime12h(schedule.close)}`,
    badgeBg: 'bg-emerald-500/15 border-emerald-400/30',
    badgeText: 'text-emerald-700',
    dotColor: 'bg-emerald-500',
    scheduleSummary,
  });
}
