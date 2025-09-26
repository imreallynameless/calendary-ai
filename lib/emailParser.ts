import { DateTime, Interval } from "luxon";

export type MeetingRequest = {
  durationMinutes: number;
  preferredDateRanges?: { start: string; end: string }[];
  notes?: string;
  timeOfDayPreferences?: ("morning" | "afternoon" | "evening")[];
  participantMentions?: string[];
};

const MONTH_PATTERN =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:,\s*(\d{2,4}))?/gi;
const NUMERIC_DATE_PATTERN = /\b(\d{1,2})[\/](\d{1,2})(?:[\/](\d{2,4}))?/g;
const NEXT_WEEKDAY_PATTERN = /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
const THIS_WEEKDAY_PATTERN = /\b(this|on)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;

const WEEKDAYS: Record<string, number> = {
  sunday: 7,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function parseMeetingRequest(
  emailBody: string,
  fallbackDuration: number,
  timeZone: string,
): MeetingRequest {
  const now = DateTime.now().setZone(timeZone);
  const ranges: Interval[] = [];
  const text = emailBody;

  const timeOfDayPrefs = extractTimeOfDayPreferences(text);
  const participantMentions = extractParticipantMentions(text);

  if (/\btomorrow\b/i.test(text)) {
    const day = now.plus({ days: 1 }).startOf("day");
    ranges.push(Interval.fromDateTimes(day, day.endOf("day")));
  }

  if (/\bnext\s+week\b/i.test(text)) {
    const start = now.plus({ weeks: 1 }).startOf("week");
    ranges.push(Interval.fromDateTimes(start, start.plus({ days: 6 }).endOf("day")));
  }

  addMatchedWeekdays(text, now, ranges, NEXT_WEEKDAY_PATTERN, true);
  addMatchedWeekdays(text, now, ranges, THIS_WEEKDAY_PATTERN, false);

  addMonthDates(text, now, ranges);
  addNumericDates(text, now, ranges);

  const preferenceRanges = ranges
    .filter((interval) => interval.isValid)
    .map((interval) => ({ start: interval.start.toISO(), end: interval.end.toISO() }));

  return {
    durationMinutes: fallbackDuration,
    preferredDateRanges: preferenceRanges.length > 0 ? preferenceRanges : undefined,
    notes: emailBody.trim(),
    timeOfDayPreferences: timeOfDayPrefs.length > 0 ? timeOfDayPrefs : undefined,
    participantMentions: participantMentions.length > 0 ? participantMentions : undefined,
  };
}

function addMatchedWeekdays(
  text: string,
  now: DateTime,
  ranges: Interval[],
  pattern: RegExp,
  isNext: boolean,
) {
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const weekday = match[2] ?? match[1];
    if (!weekday) {
      continue;
    }
    const weekdayIndex = WEEKDAYS[weekday.toLowerCase()];
    if (!weekdayIndex) {
      continue;
    }

    let candidate = now.startOf("day");
    const currentWeekday = candidate.weekday;
    const offset = ((weekdayIndex - currentWeekday + 7) % 7) || (isNext ? 7 : 0);
    candidate = candidate.plus({ days: offset || (isNext ? 7 : 0) });

    if (candidate <= now) {
      candidate = candidate.plus({ weeks: 1 });
    }

    ranges.push(Interval.fromDateTimes(candidate.startOf("day"), candidate.endOf("day")));
  }
}

function addMonthDates(text: string, now: DateTime, ranges: Interval[]) {
  MONTH_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MONTH_PATTERN.exec(text))) {
    const [, monthName, dayStr, yearStr] = match;
    const day = Number.parseInt(dayStr ?? "", 10);
    if (Number.isNaN(day)) {
      continue;
    }
    const month = DateTime.fromFormat(monthName, "MMMM").month || DateTime.fromFormat(monthName, "MMM").month;
    if (!month) {
      continue;
    }
    const year = yearStr ? normalizeYear(yearStr) : now.year;
    let candidate = DateTime.fromObject({ year, month, day, zone: now.zoneName });
    if (!candidate.isValid) {
      continue;
    }
    if (candidate < now) {
      candidate = candidate.plus({ years: 1 });
    }
    ranges.push(Interval.fromDateTimes(candidate.startOf("day"), candidate.endOf("day")));
  }
}

function addNumericDates(text: string, now: DateTime, ranges: Interval[]) {
  NUMERIC_DATE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = NUMERIC_DATE_PATTERN.exec(text))) {
    const [, monthStr, dayStr, yearStr] = match;
    const month = Number.parseInt(monthStr ?? "", 10);
    const day = Number.parseInt(dayStr ?? "", 10);
    if (Number.isNaN(month) || Number.isNaN(day)) {
      continue;
    }
    const year = yearStr ? normalizeYear(yearStr) : now.year;
    let candidate = DateTime.fromObject({ year, month, day, zone: now.zoneName });
    if (!candidate.isValid) {
      continue;
    }
    if (candidate < now) {
      candidate = candidate.plus({ years: 1 });
    }
    ranges.push(Interval.fromDateTimes(candidate.startOf("day"), candidate.endOf("day")));
  }
}

function normalizeYear(raw: string) {
  const numeric = Number.parseInt(raw, 10);
  if (Number.isNaN(numeric)) {
    return DateTime.now().year;
  }
  if (numeric < 100) {
    return 2000 + numeric;
  }
  return numeric;
}

function extractTimeOfDayPreferences(text: string) {
  const preferences = new Set<"morning" | "afternoon" | "evening">();
  if (/\bmorning\b/i.test(text)) {
    preferences.add("morning");
  }
  if (/\bafternoon\b/i.test(text)) {
    preferences.add("afternoon");
  }
  if (/\bevening\b/i.test(text)) {
    preferences.add("evening");
  }
  return Array.from(preferences);
}

function extractParticipantMentions(text: string) {
  const mentions = new Set<string>();
  const participantRegex = /\bwith\s+(?:everyone|the\s+team|(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:\s+and\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)*)/gi;
  let match: RegExpExecArray | null;
  while ((match = participantRegex.exec(text))) {
    const mention = match[0].replace(/^with\s+/i, "").trim();
    if (mention) {
      mentions.add(mention);
    }
  }
  return Array.from(mentions);
}

