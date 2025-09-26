import { DateTime, Interval } from "luxon";

type BusySlot = {
  start: string;
  end: string;
};

type ProposedSlot = {
  start: string;
  end: string;
  label: string;
};

type PlannerOptions = {
  timeZone: string;
  durationMinutes: number;
  windowStart: string;
  windowEnd: string;
  workdayStartHour?: number;
  workdayEndHour?: number;
  preferenceWindows?: { start: string; end: string }[];
  timeOfDayPreferences?: TimeOfDay[];
};

export function proposeMeetingSlots(busy: BusySlot[], options: PlannerOptions): ProposedSlot[] {
  const {
    timeZone,
    durationMinutes,
    windowStart,
    windowEnd,
    workdayStartHour = 9,
    workdayEndHour = 17,
    preferenceWindows,
    timeOfDayPreferences,
  } = options;

  const busyIntervals = busy
    .map((slot) =>
      Interval.fromDateTimes(
        DateTime.fromISO(slot.start, { zone: timeZone }),
        DateTime.fromISO(slot.end, { zone: timeZone }),
      ),
    )
    .filter((interval) => interval.isValid)
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());

  const searchStart = DateTime.fromISO(windowStart, { zone: timeZone });
  const searchEnd = DateTime.fromISO(windowEnd, { zone: timeZone });
  const duration = durationMinutes;

  if (!searchStart.isValid || !searchEnd.isValid) {
    return [];
  }

  const results: ProposedSlot[] = [];
  let cursor = roundToNextQuarterHour(searchStart.startOf("minute"));

  const preferenceIntervals = (preferenceWindows ?? [])
    .map((pref) =>
      Interval.fromDateTimes(
        DateTime.fromISO(pref.start, { zone: timeZone }),
        DateTime.fromISO(pref.end, { zone: timeZone }),
      ),
    )
    .filter((interval) => interval.isValid);

  while (cursor.plus({ minutes: duration }) <= searchEnd && results.length < 3) {
    const dayStart = roundToNextQuarterHour(cursor.set({ hour: workdayStartHour, minute: 0 }));
    const dayEnd = cursor.set({ hour: workdayEndHour, minute: 0 });

    if (cursor < dayStart) {
      cursor = dayStart;
    }

    if (cursor.plus({ minutes: duration }) > dayEnd) {
      cursor = roundToNextQuarterHour(cursor.plus({ days: 1 }).set({ hour: workdayStartHour, minute: 0 }));
      continue;
    }

    const candidate = Interval.fromDateTimes(cursor, cursor.plus({ minutes: duration }));
    if (
      preferenceIntervals.length > 0 &&
      !preferenceIntervals.some((pref) => pref.overlaps(candidate))
    ) {
      cursor = roundToNextQuarterHour(candidate.end);
      continue;
    }

    if (timeOfDayPreferences && timeOfDayPreferences.length > 0) {
      const candidatePeriod = getTimeOfDay(candidate.start);
      if (candidatePeriod && !timeOfDayPreferences.includes(candidatePeriod)) {
        cursor = roundToNextQuarterHour(candidate.end);
        continue;
      }
    }

    const overlapsBusy = busyIntervals.some((busyInterval) => busyInterval.overlaps(candidate));

    if (!overlapsBusy) {
      results.push({
        start: candidate.start.toISO(),
        end: candidate.end.toISO(),
        label: candidate.start.toFormat("EEE MMM d, h:mm a"),
      });
      cursor = roundToNextQuarterHour(candidate.end);
    } else {
      const nextPossible = busyIntervals
        .filter((busyInterval) => busyInterval.start >= candidate.start)
        .reduce(
          (soonest, interval) => (soonest < interval.end ? soonest : interval.end),
          candidate.end,
        );
      cursor = roundToNextQuarterHour(nextPossible);
    }
  }

  return results;
}

function roundToNextQuarterHour(dateTime: DateTime) {
  if (!dateTime.isValid) {
    return dateTime;
  }
  const minutes = dateTime.minute;
  const remainder = minutes % 15;
  if (remainder === 0) {
    return dateTime;
  }
  return dateTime.plus({ minutes: 15 - remainder }).set({ second: 0, millisecond: 0 });
}

type TimeOfDay = "morning" | "afternoon" | "evening";

function getTimeOfDay(date: DateTime): TimeOfDay | undefined {
  const hour = date.hour + date.minute / 60;
  if (hour >= 9 && hour < 12) {
    return "morning";
  }
  if (hour >= 12 && hour < 17) {
    return "afternoon";
  }
  if (hour >= 17 && hour < 21) {
    return "evening";
  }
  return undefined;
}

