import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { ProductQueryService } from './services/product-query.service';
import { ProductMutationService } from './services/product-mutation.service';

@Module({
  controllers: [ProductController],
  providers: [ProductService, ProductQueryService, ProductMutationService],
  exports: [ProductService],
})
export class ProductModule {}
