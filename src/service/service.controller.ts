import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ServiceService } from './service.service';
import { Language, Service } from '@prisma/client';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../src/config/multer.config';

import { Lang } from '../../decorators/accept.language';
import { AuthGuard } from '../../guard/auth.guard';
import { RolesGuard } from '../../guard/role.guard';
import { Roles } from '../../decorators/roles.decorator';

@Controller('service')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @UseGuards(AuthGuard(false))
  @Get()
  public async findAllService(@Lang() lang: Language) {
    return await this.serviceService.getAllService(lang);
  }

  @UseGuards(AuthGuard(false))
  @Get(':id')
  public async findServiceById(
    @Param('id', ParseUUIDPipe) id: string,
    @Lang() language: Language,
  ) {
    return await this.serviceService.getServiceById(id, language);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Post()
  @UseInterceptors(FileInterceptor('file', multerConfig('services')))
  public async createService(
    @Body() createServiceDto: CreateServiceDto,
    @UploadedFile() file: Express.Multer.File,
    @Lang() language: Language,
  ) {
    return await this.serviceService.createService(
      createServiceDto,
      file,
      language,
    );
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Put(':id')
  @UseInterceptors(FileInterceptor('file', multerConfig('services')))
  public async updateService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceDto: UpdateServiceDto,
    @UploadedFile() file: Express.Multer.File,
    @Lang() language: Language,
  ) {
    return await this.serviceService.updateService(
      id,
      updateServiceDto,
      file,
      language,
    );
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Put(':id/status')
  public async softDeleteService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() available: { available: boolean },
  ) {
    return await this.serviceService.softDeleteService(id, available);
  }
}
