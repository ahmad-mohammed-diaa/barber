import * as bcrypt from 'bcrypt';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

export const hashedPassword = async (password: string) =>
  await bcrypt.hash(password, 10);

export const comparePassword = async (
  password: string,
  hashedPassword: string,
) => await bcrypt.compare(password, hashedPassword);

export const EGYPT_TIMEZONE = 'Africa/Cairo';

export const getOrderDateTime = (
  order: any & { client: { fcmToken: string } },
): { date: Date; fcmToken: string } => {
  const slot = order.slot.trim();
  const amPmRegex = /(\d{1,2}):(\d{2})\s?(AM|PM)/i;
  const h24Regex = /^(\d{1,2}):(\d{2})$/;

  let hours: number;
  let minutes: number;

  const amPmMatch = slot.match(amPmRegex);
  const h24Match = slot.match(h24Regex);

  if (amPmMatch) {
    const [, hoursStr, minutesStr, meridiem] = amPmMatch;
    hours = parseInt(hoursStr, 10);
    minutes = parseInt(minutesStr, 10);
    if (meridiem.toUpperCase() === 'PM' && hours !== 12) hours += 12;
    if (meridiem.toUpperCase() === 'AM' && hours === 12) hours = 0;
  } else if (h24Match) {
    hours = parseInt(h24Match[1], 10);
    minutes = parseInt(h24Match[2], 10);
  } else {
    return null;
  }

  const date = new Date(order.date);
  date.setHours(hours);
  date.setMinutes(minutes);
  date.setSeconds(0);

  return { date, fcmToken: order.client.fcmToken };
};

export function getEgyptDateRange(
  fromDate?: string | Date,
  toDate?: string | Date,
) {
  const normalizeDateDay = (
    value: string | Date | undefined,
    fallback: string,
  ) => {
    if (!value) return fallback;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime())
        ? fallback
        : formatInTimeZone(value, EGYPT_TIMEZONE, 'yyyy-MM-dd');
    }

    const day = value.trim().slice(0, 10);
    const match = day.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) return fallback;

    const [, year, month, date] = match;
    const parsedDay = new Date(`${day}T00:00:00.000Z`);

    if (
      Number.isNaN(parsedDay.getTime()) ||
      parsedDay.getUTCFullYear() !== Number(year) ||
      parsedDay.getUTCMonth() + 1 !== Number(month) ||
      parsedDay.getUTCDate() !== Number(date)
    ) {
      return fallback;
    }

    return day;
  };

  const todayInEgypt = formatInTimeZone(
    new Date(),
    EGYPT_TIMEZONE,
    'yyyy-MM-dd',
  );

  const fromDay = normalizeDateDay(fromDate, todayInEgypt);
  const toDay = normalizeDateDay(toDate, fromDay);

  const fromStart = fromZonedTime(`${fromDay}T00:00:00.000`, EGYPT_TIMEZONE);
  const toEnd = fromZonedTime(`${toDay}T23:59:59.999`, EGYPT_TIMEZONE);

  return { fromStart, toEnd };
}
