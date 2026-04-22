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
import { ApiTags } from '@nestjs/swagger';
import { ServiceService } from './service.service';
import { Language } from '@prisma/client';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceStatusDto } from './dto/service-status.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../config/multer.config';
import { Lang } from '../../../decorators/accept.language';
import { AuthGuard } from '../../../guard/auth.guard';
import { RolesGuard } from '../../../guard/role.guard';
import { Roles } from '../../../decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import {
  FindAllServicesDoc,
  FindServiceByIdDoc,
  CreateServiceDoc,
  UpdateServiceDoc,
  SoftDeleteServiceDoc,
} from './service.swagger';

@ApiTags('Service')
@Controller('service')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @UseGuards(AuthGuard(false))
  @Get()
  @ResponseMessage('Services found successfully')
  @FindAllServicesDoc()
  public async findAllService(@Lang() lang: Language) {
    return this.serviceService.getAllService(lang);
  }

  @UseGuards(AuthGuard(false))
  @Get(':id')
  @ResponseMessage('Service found successfully')
  @FindServiceByIdDoc()
  public async findServiceById(
    @Param('id', ParseUUIDPipe) id: string,
    @Lang() language: Language,
  ) {
    return this.serviceService.getServiceById(id, language);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Post()
  @UseInterceptors(FileInterceptor('file', multerConfig('services')))
  @ResponseMessage('Service created successfully')
  @CreateServiceDoc()
  public async createService(
    @Body() createServiceDto: CreateServiceDto,
    @UploadedFile() file: Express.Multer.File,
    @Lang() language: Language,
  ) {
    return this.serviceService.createService(createServiceDto, file, language);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Put(':id')
  @UseInterceptors(FileInterceptor('file', multerConfig('services')))
  @ResponseMessage('Service updated successfully')
  @UpdateServiceDoc()
  public async updateService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateServiceDto: UpdateServiceDto,
    @UploadedFile() file: Express.Multer.File,
    @Lang() language: Language,
  ) {
    return this.serviceService.updateService(id, updateServiceDto, file, language);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Put(':id/status')
  @ResponseMessage('Service deleted successfully')
  @SoftDeleteServiceDoc()
  public async softDeleteService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ServiceStatusDto,
  ) {
    return this.serviceService.softDeleteService(id, dto);
  }
}
