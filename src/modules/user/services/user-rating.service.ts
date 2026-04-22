import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class UserRatingService {
  constructor(private readonly prisma: PrismaService) {}

  public async rateBarber(
    clientId: string,
    barberId: string,
    orderId: string,
    rate: number,
  ) {
    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
      include: {
        user: { select: { firstName: true, lastName: true, avatar: true } },
      },
    });

    if (!barber) throw new NotFoundException('Barber not found');

    const completedOrder = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId: clientId,
        barberId,
        status: { in: [OrderStatus.COMPLETED, OrderStatus.PAID] },
        deleted: false,
      },
    });

    if (!completedOrder) {
      throw new NotFoundException(
        'No completed order found for this barber and client',
      );
    }

    const existingRating = await this.prisma.barberRating.findUnique({
      where: { barberId_clientId_orderId: { barberId, clientId, orderId } },
    });

    if (existingRating) {
      throw new ConflictException('This order has already been rated');
    }

    await this.prisma.barberRating.create({
      data: { barberId, clientId, orderId, rate },
    });

    const { _avg } = await this.prisma.barberRating.aggregate({
      where: { barberId },
      _avg: { rate: true },
    });

    const updatedBarber = await this.prisma.barber.update({
      where: { id: barberId },
      data: { rate: _avg.rate || 0 },
      include: {
        user: { select: { firstName: true, lastName: true, avatar: true } },
      },
    });

    return {
      barber: {
        id: updatedBarber.id,
        name: `${updatedBarber.user.firstName} ${updatedBarber.user.lastName}`,
        avatar: updatedBarber.user.avatar,
        rate: Number(updatedBarber.rate.toFixed(1)),
      },
      yourRate: rate,
    };
  }
}
