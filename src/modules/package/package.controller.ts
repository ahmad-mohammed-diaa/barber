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
import { ApiTags } from '@nestjs/swagger';
import { PackageService } from './package.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { AuthGuard } from '../../common/guard/auth.guard';
import { RolesGuard } from '../../common/guard/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../common/config/multer.config';
import { Lang } from '../../common/decorators/accept.language';
import { Language } from '@prisma/client';
import {
  CreatePackageDoc,
  FindAllPackagesDoc,
  FindOnePackageDoc,
  UpdatePackageDoc,
  RemovePackageDoc,
} from './package.swagger';

@ApiTags('Package')
@UseGuards(AuthGuard(), RolesGuard)
@Controller('package')
export class PackageController {
  constructor(private readonly packageService: PackageService) {}

  @Post()
  @CreatePackageDoc()
  @UseInterceptors(FileInterceptor('file', multerConfig('packages')))
  create(
    @Body() createPackageDto: CreatePackageDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.packageService.create(createPackageDto, file);
  }

  @Get()
  @FindAllPackagesDoc()
  findAll(@Lang() language: Language) {
    return this.packageService.findAll(language);
  }

  @Get(':id')
  @FindOnePackageDoc()
  findOne(@Param('id') id: string, @Lang() language: Language) {
    return this.packageService.findOne(id, language);
  }

  @Roles(['ADMIN'])
  @Put(':id')
  @UpdatePackageDoc()
  update(@Param('id') id: string) {
    return this.packageService.update(id);
  }

  @Delete('delete-many')
  @RemovePackageDoc()
  remove(@Param('id') _id: string) {
    return this.packageService.remove();
  }
}
