import { describe, it, expect } from "vitest";
import {
  getZonedTime,
  addZonedDays,
  getZonedStartOfDay,
  getZonedEndOfDay,
  formatZonedDate,
} from "./index";

describe("Temporal Primitives", () => {
  describe("DST and Timezone additions", () => {
    it("should handle DST forward transition in America/New_York", () => {
      // In 2024, DST starts in NY on March 10 at 2:00 AM.
      // Clock goes from 1:59 AM to 3:00 AM.
      // If we add 1 day to March 9, 12:00 PM, it should be March 10, 12:00 PM
      const beforeDST = new Date("2024-03-09T17:00:00.000Z"); // 12:00 PM EST
      const tz = "America/New_York";

      const localBefore = getZonedTime(beforeDST, tz);
      expect(localBefore.getHours()).toBe(12);

      const afterAddingDay = addZonedDays(beforeDST, 1, tz);
      // Wait, date-fns `addDays` adds exactly 24 hours locally.
      // So if it was 12:00 PM EST, it should be 12:00 PM EDT.
      expect(afterAddingDay.getHours()).toBe(12);
      expect(afterAddingDay.getDate()).toBe(10);
    });

    it("should handle DST backward transition in Europe/London", () => {
      // In 2024, DST ends in London on October 27 at 2:00 AM.
      // Clock goes from 1:59 AM back to 1:00 AM.
      const beforeDST = new Date("2024-10-26T11:00:00.000Z"); // 12:00 PM BST
      const tz = "Europe/London";

      const localBefore = getZonedTime(beforeDST, tz);
      expect(localBefore.getHours()).toBe(12);

      const afterAddingDay = addZonedDays(beforeDST, 1, tz);
      expect(afterAddingDay.getHours()).toBe(12);
      expect(afterAddingDay.getDate()).toBe(27);
    });
  });

  describe("Day boundaries in timezones", () => {
    it("should get correct start of day in Asia/Tokyo vs America/Los_Angeles", () => {
      // Tokyo is UTC+9, LA is UTC-8 (or -7)
      const date = new Date("2024-01-01T00:00:00.000Z");

      const startTokyo = getZonedStartOfDay(date, "Asia/Tokyo");
      const startLA = getZonedStartOfDay(date, "America/Los_Angeles");

      // In Tokyo (UTC+9), 2024-01-01 00:00 UTC is 2024-01-01 09:00. So start of day is 2024-01-01 00:00 Tokyo time.
      expect(startTokyo.getHours()).toBe(0);
      expect(startTokyo.getMinutes()).toBe(0);

      // In LA (UTC-8), 2024-01-01 00:00 UTC is 2023-12-31 16:00. Start of day is 2023-12-31 00:00 LA time.
      expect(startLA.getHours()).toBe(0);
      expect(startLA.getMinutes()).toBe(0);
    });
  });

  describe("Formatting", () => {
    it("should format date correctly in target timezone", () => {
      const date = new Date("2024-06-01T12:00:00.000Z");
      // UTC 12:00 PM -> 08:00 AM EDT
      const formatted = formatZonedDate(date, "yyyy-MM-dd HH:mm", "America/New_York");
      expect(formatted).toBe("2024-06-01 08:00");

      // UTC 12:00 PM -> 21:00 JST
      const formattedTokyo = formatZonedDate(date, "yyyy-MM-dd HH:mm", "Asia/Tokyo");
      expect(formattedTokyo).toBe("2024-06-01 21:00");
    });
  });
});
