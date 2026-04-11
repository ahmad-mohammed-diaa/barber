import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Query,
} from '@nestjs/common';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../src/config/multer.config';

import { Lang } from '../../decorators/accept.language';
import { CategoryType, Language } from '@prisma/client';
import { AuthGuard } from '../../guard/auth.guard';
import { RolesGuard } from '../../guard/role.guard';
import { Roles } from '../../decorators/roles.decorator';

@Controller('branch')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Post()
  @UseInterceptors(FileInterceptor('file', multerConfig('branches')))
  create(
    @Body() createBranchDto: CreateBranchDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.branchService.create(createBranchDto, file);
  }

  @UseGuards(AuthGuard(false))
  @Get()
  findAll(@Lang() language: Language) {
    return this.branchService.findAll(language);
  }

  @UseGuards(AuthGuard(false))
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Lang() language: Language,
    @Query('Date') Date: string,
    @Query('type') type: CategoryType,
  ) {
    return this.branchService.findOne(id, type, Date, language);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @UseInterceptors(FileInterceptor('file', multerConfig('branches')))
  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBranchDto: UpdateBranchDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.branchService.update(id, updateBranchDto, file);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchService.remove(id);
  }
}
