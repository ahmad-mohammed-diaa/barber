import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class OrderQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findOneOrFail(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        service: true,
        barber: { include: { barber: true } },
        client: true,
      },
    });
    if (!order) throw new ConflictException(`Order with ID "${id}" not found`);
    if (!order.client) throw new NotFoundException('Client not found');

    const { client, ...rest } = order;
    return {
      ...rest,
      clientName: `${client.firstName} ${client.lastName}`,
      clientPhone: client.phone,
    };
  }

  validatePoints(
    total: number,
    points: number,
    clientPoints: number,
    limitPoints: number,
  ) {
    if (points < 0) throw new BadRequestException('Points cannot be negative');
    if (!Number.isInteger(points))
      throw new BadRequestException('Points must be a whole number');
    if (points < limitPoints)
      throw new BadRequestException(
        `Minimum points required is ${limitPoints} points`,
      );
    if (points > (clientPoints ?? 0))
      throw new BadRequestException('Client does not have enough points');
    const maxPointsDiscount = total * 0.4;
    const pointsDiscount = Math.floor(points / 1000) * 50;
    if (pointsDiscount > maxPointsDiscount) {
      throw new BadRequestException(
        `Points discount cannot exceed 40% of total (${maxPointsDiscount})`,
      );
    }
    return pointsDiscount;
  }
}
