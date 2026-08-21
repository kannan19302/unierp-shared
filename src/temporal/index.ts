import {
  addDays,
  addMonths,
  addYears,
  startOfDay,
  endOfDay,
} from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";

/**
 * Converts a UTC Date or ISO string into a local Date object in the target timezone.
 * Useful for extracting the local calendar date and time.
 *
 * @param date - The source date
 * @param timeZone - The IANA timezone string (e.g., "America/New_York")
 * @returns A Date object where the local components match the target timezone
 */
export function getZonedTime(date: Date | string | number, timeZone: string): Date {
  return toZonedTime(date, timeZone);
}

/**
 * Adds a specific number of days to a date, respecting timezone boundaries (e.g. DST).
 *
 * @param date - The source date
 * @param days - Number of days to add
 * @param timeZone - The IANA timezone string
 * @returns The new date in the specified timezone
 */
export function addZonedDays(date: Date | string | number, days: number, timeZone: string): Date {
  const zonedDate = toZonedTime(date, timeZone);
  return addDays(zonedDate, days);
}

/**
 * Adds a specific number of months to a date, respecting timezone boundaries.
 */
export function addZonedMonths(date: Date | string | number, months: number, timeZone: string): Date {
  const zonedDate = toZonedTime(date, timeZone);
  return addMonths(zonedDate, months);
}

/**
 * Adds a specific number of years to a date, respecting timezone boundaries.
 */
export function addZonedYears(date: Date | string | number, years: number, timeZone: string): Date {
  const zonedDate = toZonedTime(date, timeZone);
  return addYears(zonedDate, years);
}

/**
 * Gets the start of the day in a given timezone.
 */
export function getZonedStartOfDay(date: Date | string | number, timeZone: string): Date {
  const zonedDate = toZonedTime(date, timeZone);
  return startOfDay(zonedDate);
}

/**
 * Gets the end of the day in a given timezone.
 */
export function getZonedEndOfDay(date: Date | string | number, timeZone: string): Date {
  const zonedDate = toZonedTime(date, timeZone);
  return endOfDay(zonedDate);
}

/**
 * Formats a date within a specific timezone.
 */
export function formatZonedDate(
  date: Date | string | number,
  formatString: string,
  timeZone: string
): string {
  return formatInTimeZone(date, timeZone, formatString);
}
