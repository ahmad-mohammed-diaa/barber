import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { multerConfig } from '@/config/multer.config';
import {
  CreateProductDoc,
  GetAllProductsDoc,
  GetProductByIdDoc,
  UpdateProductDoc,
  DeleteProductDoc,
} from './product.swagger';

@ApiTags('Product')
@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @CreateProductDoc()
  @UseInterceptors(FileInterceptor('file', multerConfig('products')))
  createProduct(
    @Body() createProductDto: CreateProductDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.productService.createProduct(createProductDto, file);
  }

  @Get()
  @GetAllProductsDoc()
  getAllProducts() {
    return this.productService.getAllProducts();
  }

  @Get(':id')
  @GetProductByIdDoc()
  getProductById(@Param('id') id: string) {
    return this.productService.getProductById(id);
  }

  @Put(':id')
  @UpdateProductDoc()
  updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productService.updateProduct(id, updateProductDto);
  }

  @Delete(':id')
  @DeleteProductDoc()
  deleteProduct(@Param('id') id: string) {
    return this.productService.deleteProduct(id);
  }
}
