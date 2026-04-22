import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { AppSuccess } from 'src/utils/AppSuccess';
import {
  createTranslation,
  updateTranslation,
} from 'src/class-type/translation';

@Injectable()
export class ProductMutationService {
  constructor(private readonly prisma: PrismaService) {}

  async createProduct(
    createProductDto: CreateProductDto,
    file: Express.Multer.File,
  ) {
    const productImgUrl = file?.path;

    const product = await this.prisma.product.create({
      data: {
        ...(productImgUrl && { productImg: productImgUrl }),
        ...createProductDto,
        Translation: createTranslation(createProductDto),
      },
    });

    return new AppSuccess(product, 'Product created successfully', 201);
  }

  async updateProduct(id: string, updateProductDto: UpdateProductDto) {
    const { productImg, price, available } = updateProductDto;

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        Translation: updateTranslation(updateProductDto),
        productImg,
        price,
        available,
      },
    });

    return new AppSuccess(product, 'Product updated successfully', 200);
  }

  async deleteProduct(id: string) {
    const product = await this.prisma.product.delete({
      where: { id },
    });

    return new AppSuccess(product, 'Product deleted successfully', 200);
  }
}
