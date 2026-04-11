import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { Category, CategoryType, Language, User } from '@prisma/client';
import { CreateCategoryDto } from './dto/create-category.dto';
import { AuthGuard } from '../../guard/auth.guard';
import { RolesGuard } from '../../guard/role.guard';
import { Roles } from '../../decorators/roles.decorator';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AppSuccess } from 'src/utils/AppSuccess';
import { UserData } from '../../decorators/user.decorator';
import { Lang } from '../../decorators/accept.language';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @UseGuards(AuthGuard(false))
  @Get()
  public async findAllCategories(
    @UserData('user') user: User,
    @Lang() lang: Language,
    @Query('type') type: CategoryType,
  ): Promise<AppSuccess<{ categories: Category[]; package: any }>> {
    return await this.categoryService.findAllCategories(user, lang, type);
  }

  @UseGuards(AuthGuard(false))
  @Get(':id')
  public async findCategoryById(
    @Param('id', ParseUUIDPipe) id: string,
    @Lang() language: Language,
  ): Promise<AppSuccess<Category>> {
    return await this.categoryService.findCategoryById(id, language);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Post()
  public async createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
    @Lang() language: Language,
  ): Promise<AppSuccess<Category>> {
    return await this.categoryService.createCategory(
      createCategoryDto,
      language,
    );
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Put(':id')
  public async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Lang() language: Language,
  ): Promise<AppSuccess<Category>> {
    return await this.categoryService.updateCategory(
      id,
      updateCategoryDto,
      language,
    );
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Delete(':id')
  public async deleteCategory(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AppSuccess<Category>> {
    return await this.categoryService.delete(id);
  }
}
