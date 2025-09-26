import { describe, it, expect } from "vitest";
import { proposeMeetingSlots } from "./timePlanner";

const TIMEZONE = "America/New_York";

describe("proposeMeetingSlots", () => {
  it("returns slots at 15-minute increments respecting work hours", () => {
    const busy = [
      { start: "2025-09-29T13:00:00-04:00", end: "2025-09-29T14:00:00-04:00" },
    ];
    const windowStart = "2025-09-29T09:00:00-04:00";
    const windowEnd = "2025-09-29T17:00:00-04:00";

    const slots = proposeMeetingSlots(busy, {
      timeZone: TIMEZONE,
      durationMinutes: 45,
      windowStart,
      windowEnd,
    });

    expect(slots.length).toBeGreaterThan(0);
    slots.forEach((slot) => {
      const minute = new Date(slot.start).getMinutes();
      expect(minute % 15).toBe(0);
    });
  });

  it("respects time-of-day preferences", () => {
    const busy: { start: string; end: string }[] = [];
    const windowStart = "2025-09-29T06:00:00-04:00";
    const windowEnd = "2025-09-29T21:00:00-04:00";

    const slots = proposeMeetingSlots(busy, {
      timeZone: TIMEZONE,
      durationMinutes: 30,
      windowStart,
      windowEnd,
      timeOfDayPreferences: ["morning"],
    });

    expect(slots.length).toBeGreaterThan(0);
    slots.forEach((slot) => {
      const hour = new Date(slot.start).getHours();
      expect(hour >= 9 && hour < 12).toBe(true);
    });
  });

  it("avoids busy intervals", () => {
    const busy = [
      { start: "2025-09-29T09:00:00-04:00", end: "2025-09-29T10:00:00-04:00" },
    ];
    const windowStart = "2025-09-29T09:00:00-04:00";
    const windowEnd = "2025-09-29T12:00:00-04:00";

    const slots = proposeMeetingSlots(busy, {
      timeZone: TIMEZONE,
      durationMinutes: 30,
      windowStart,
      windowEnd,
    });

    slots.forEach((slot) => {
      const start = new Date(slot.start).getTime();
      const end = new Date(slot.end).getTime();
      const busyStart = new Date(busy[0].start).getTime();
      const busyEnd = new Date(busy[0].end).getTime();

      const overlaps = Math.max(0, Math.min(end, busyEnd) - Math.max(start, busyStart));
      expect(overlaps).toBe(0);
    });
  });
});

