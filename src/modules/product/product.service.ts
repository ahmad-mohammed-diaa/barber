import { Injectable } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryService } from './services/product-query.service';
import { ProductMutationService } from './services/product-mutation.service';

@Injectable()
export class ProductService {
  constructor(
    private readonly productQuery: ProductQueryService,
    private readonly productMutation: ProductMutationService,
  ) {}

  getAllProducts() {
    return this.productQuery.getAllProducts();
  }

  getProductById(id: string) {
    return this.productQuery.getProductById(id);
  }

  createProduct(dto: CreateProductDto, file: Express.Multer.File) {
    return this.productMutation.createProduct(dto, file);
  }

  updateProduct(id: string, dto: UpdateProductDto) {
    return this.productMutation.updateProduct(id, dto);
  }

  deleteProduct(id: string) {
    return this.productMutation.deleteProduct(id);
  }
}
