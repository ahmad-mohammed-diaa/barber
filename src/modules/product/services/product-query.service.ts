import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AppSuccess } from '../../../common/utils/AppSuccess';

@Injectable()
export class ProductQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllProducts() {
    const products = await this.prisma.product.findMany();
    return new AppSuccess({ products }, 'Products fetched successfully', 200);
  }

  async getProductById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return new AppSuccess(product, 'Product fetched successfully', 200);
  }
}
