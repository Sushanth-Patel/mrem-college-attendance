import { differenceInCalendarDays } from 'date-fns'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'

export const IST_TIMEZONE = 'Asia/Kolkata'

export function getISTNow(): Date {
  return toZonedTime(new Date(), IST_TIMEZONE)
}

export function toIST(date: Date | string): Date {
  return toZonedTime(new Date(date), IST_TIMEZONE)
}

export function formatIST(date: Date | string, format = 'dd MMM yyyy, hh:mm a'): string {
  return formatInTimeZone(new Date(date), IST_TIMEZONE, format)
}

export function isWithinFacultyEditWindow(sessionDate: Date | string): boolean {
  const nowIST = getISTNow()
  const sessionIST = toIST(sessionDate)
  const diffDays = differenceInCalendarDays(nowIST, sessionIST)
  // Faculty can correct attendance for any session conducted today or in the past
  return diffDays >= 0
}
