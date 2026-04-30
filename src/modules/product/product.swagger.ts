import { ApiDoc } from '../../common/lib/swagger';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

export const CreateProductDoc = () =>
  ApiDoc({
    summary: 'Create a new product',
    body: CreateProductDto,
    extraModels: [CreateProductDto],
  });

export const GetAllProductsDoc = () =>
  ApiDoc({
    summary: 'Get all products',
  });

export const GetProductByIdDoc = () =>
  ApiDoc({
    summary: 'Get a product by ID',
    params: [{ name: 'id', type: 'string' }],
  });

export const UpdateProductDoc = () =>
  ApiDoc({
    summary: 'Update a product by ID',
    params: [{ name: 'id', type: 'string' }],
    body: UpdateProductDto,
    extraModels: [UpdateProductDto],
  });

export const DeleteProductDoc = () =>
  ApiDoc({
    summary: 'Delete a product by ID',
    params: [{ name: 'id', type: 'string' }],
  });
