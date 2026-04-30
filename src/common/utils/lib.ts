import { Order } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export const hashedPassword = async (password: string) =>
  await bcrypt.hash(password, 10);

export const comparePassword = async (
  password: string,
  hashedPassword: string,
) => await bcrypt.compare(password, hashedPassword);

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
