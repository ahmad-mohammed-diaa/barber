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
import { ApiTags } from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CategoryType, Language, User } from '@prisma/client';
import { CreateCategoryDto } from './dto/create-category.dto';
import { AuthGuard } from '../../common/guard/auth.guard';
import { RolesGuard } from '../../common/guard/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UserData } from '../../common/decorators/user.decorator';
import { Lang } from '../../common/decorators/accept.language';
import {
  FindAllCategoriesDoc,
  FindCategoryByIdDoc,
  CreateCategoryDoc,
  UpdateCategoryDoc,
  DeleteCategoryDoc,
} from './category.swagger';

@ApiTags('Category')
@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @UseGuards(AuthGuard(false))
  @Get()
  @FindAllCategoriesDoc()
  public async findAllCategories(
    @UserData('user') user: User,
    @Lang() lang: Language,
    @Query('type') type: CategoryType,
  ) {
    return this.categoryService.findAllCategories(user, lang, type);
  }

  @UseGuards(AuthGuard(false))
  @Get(':id')
  @FindCategoryByIdDoc()
  public async findCategoryById(
    @Param('id', ParseUUIDPipe) id: string,
    @Lang() language: Language,
  ) {
    return this.categoryService.findCategoryById(id, language);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Post()
  @CreateCategoryDoc()
  public async createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
    @Lang() language: Language,
  ) {
    return this.categoryService.createCategory(createCategoryDto, language);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Put(':id')
  @UpdateCategoryDoc()
  public async updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Lang() language: Language,
  ) {
    return this.categoryService.updateCategory(id, updateCategoryDto, language);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Delete(':id')
  @DeleteCategoryDoc()
  public async deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoryService.delete(id);
  }
}
