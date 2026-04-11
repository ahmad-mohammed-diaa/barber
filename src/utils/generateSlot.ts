import { BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export const generateSlots = async (
  prisma: PrismaService,
  start: number,
  end: number,
) => {
  const duration = (await prisma.settings.findFirst({}))?.slotDuration ?? 30;

  if (!Number.isInteger(start) || !Number.isInteger(end))
    throw new BadRequestException(
      'Start and end must not be decimal, negative or string.',
    );

  if (start < 0 || start >= 24 || end < 0 || end > 24) {
    throw new BadRequestException(
      'Start and end must be Integer numbers between 0 and 24.',
    );
  }

  const slotsArray: string[] = [];

  // Handle case where time spans across midnight (e.g., start: 14, end: 0)
  if (start >= end) {
    // From start to end of day (24:00)
    for (let time = start * 60; time < 24 * 60; time += duration) {
      const hour = Math.floor(time / 60);
      const minute = time % 60;
      const formattedHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const period = hour >= 12 ? 'PM' : 'AM';
      const slot = `${formattedHour.toString().padStart(2, '0')}:${minute
        .toString()
        .padStart(2, '0')} ${period}`;
      slotsArray.push(slot);
    }

    // From start of day (00:00) to end - only if end > 0
    if (end > 0) {
      for (let time = 0; time < end * 60; time += duration) {
        const hour = Math.floor(time / 60);
        const minute = time % 60;
        const formattedHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
        const period = hour >= 12 ? 'PM' : 'AM';
        const slot = `${formattedHour.toString().padStart(2, '0')}:${minute
          .toString()
          .padStart(2, '0')} ${period}`;
        slotsArray.push(slot);
      }
    }
  } else {
    // Normal case where start < end
    for (let time = start * 60; time < end * 60; time += duration) {
      const hour = Math.floor(time / 60);
      const minute = time % 60;
      const formattedHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const period = hour >= 12 ? 'PM' : 'AM';
      const slot = `${formattedHour.toString().padStart(2, '0')}:${minute
        .toString()
        .padStart(2, '0')} ${period}`;
      slotsArray.push(slot);
    }
  }

  return slotsArray;
};
