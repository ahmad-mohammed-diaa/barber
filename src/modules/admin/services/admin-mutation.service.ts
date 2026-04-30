import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AppSuccess } from '../../../common/utils/AppSuccess';
import { comparePassword, hashedPassword } from '../../../common/utils/lib';
import { CreateAdminDto } from '../dto/create-admin.dto';
import { UpdateAdminDto } from '../dto/update-admin.dto';

@Injectable()
export class AdminMutationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createAdminDto: CreateAdminDto) {
    const { password, ...rest } = createAdminDto;
    const settings = await this.prisma.settings.findFirst();

    if (!settings) {
      return this.prisma.settings.create({
        data: {
          ...rest,
          ...(password && { password: await hashedPassword(password) }),
        },
      });
    }
  }

  async update(updateAdminDto: UpdateAdminDto) {
    const { password, ...rest } = updateAdminDto;
    const ExistingSettings = await this.prisma.settings.findFirst();

    if (!ExistingSettings) {
      return new AppSuccess(ExistingSettings, 'Settings not found');
    }

    const settingsData = {
      ...rest,
      ...(password && { password: await hashedPassword(password) }),
    } as Prisma.SettingsUpsertArgs['create'] &
      Prisma.SettingsUpsertArgs['update'];

    const settings = await this.prisma.settings.upsert({
      where: { id: ExistingSettings.id },
      update: settingsData,
      create: settingsData,
    });

    if (updateAdminDto.slotDuration) {
      const slots = await this.prisma.slot.findMany({
        select: {
          id: true,
          start: true,
          end: true,
          slot: true,
        },
      });

      // Update each slot with new duration
      await Promise.all(
        slots.map(async (slot) => {
          try {
            const newSlots = await this.generateSlots(
              slot.start,
              slot.end,
              updateAdminDto.slotDuration,
            );

            return this.prisma.slot.update({
              where: { id: slot.id },
              data: {
                slot: newSlots,
                // Clear any pending slot updates when duration changes
                updatedSlot: [],
                effectiveSlotDate: null,
              },
            });
          } catch (error) {
            console.error(`Failed to update slot ${slot.id}:`, error);
            throw error;
          }
        }),
      );
    }

    return new AppSuccess(settings, 'Settings updated successfully');
  }

  async CheckPassword(password: string) {
    const settings = await this.prisma.settings.findFirst({
      select: { password: true },
    });
    if (!password) return false;
    const valid = await comparePassword(password, settings.password);
    if (!valid) return false;
    return true;
  }

  private async generateSlots(start: number, end: number, duration: number) {
    const slotsArray = [];
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
    return slotsArray;
  }
}
