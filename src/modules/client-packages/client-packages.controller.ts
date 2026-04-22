import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClientPackagesService } from './client-packages.service';
import { Language } from '@prisma/client';
import { AuthGuard } from '../../../guard/auth.guard';
import { Lang } from '../../../decorators/accept.language';
import {
  CreateClientPackageDoc,
  FindAllClientPackagesDoc,
  FindOneClientPackageDoc,
  UpdateClientPackageDoc,
  RemoveClientPackageDoc,
} from './client-packages.swagger';

@ApiTags('Client Packages')
@UseGuards(AuthGuard())
@Controller('client-packages')
export class ClientPackagesController {
  constructor(private readonly clientPackagesService: ClientPackagesService) {}

  @Post()
  @CreateClientPackageDoc()
  create(
    @Body('phone') phone: string,
    @Query('packageId') packageId: string,
    @Lang() lang: Language,
  ) {
    return this.clientPackagesService.create(packageId, phone, lang);
  }

  @Get()
  @FindAllClientPackagesDoc()
  findAll(@Lang() language: Language) {
    return this.clientPackagesService.findAll(language);
  }

  @Get(':id')
  @FindOneClientPackageDoc()
  findOne(@Param('id') id: string, @Lang() language: Language) {
    return this.clientPackagesService.findOne(id, language);
  }

  @Patch(':id')
  @UpdateClientPackageDoc()
  update(@Param('id') id: string) {
    return this.clientPackagesService.update(+id);
  }

  @Delete(':id')
  @RemoveClientPackageDoc()
  remove(@Param('id') id: string) {
    return this.clientPackagesService.remove(id);
  }
}
