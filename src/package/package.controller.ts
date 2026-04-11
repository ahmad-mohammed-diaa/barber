import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { PackageService } from './package.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { AuthGuard } from '../../guard/auth.guard';
import { RolesGuard } from '../../guard/role.guard';
import { Roles } from '../../decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../src/config/multer.config';
import { Lang } from '../../decorators/accept.language';
import { Language } from '@prisma/client';

@UseGuards(AuthGuard(), RolesGuard)
@Controller('package')
export class PackageController {
  constructor(private readonly packageService: PackageService) {}

  @UseInterceptors(FileInterceptor('file', multerConfig('packages')))
  @Post()
  create(
    @Body() createPackageDto: CreatePackageDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.packageService.create(createPackageDto, file);
  }

  @Get()
  findAll(@Lang() language: Language) {
    return this.packageService.findAll(language);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Lang() language: Language) {
    return this.packageService.findOne(id, language);
  }

  @Roles(['ADMIN'])
  @Put(':id')
  update(@Param('id') id: string) {
    return this.packageService.update(id);
  }

  @Delete('delete-many')
  remove(@Param('id') id: string) {
    return this.packageService.remove();
  }
}
