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
import { ClientPackagesService } from './client-packages.service';
import { Language, User } from '@prisma/client';
import { AuthGuard } from '../../guard/auth.guard';
import { Lang } from '../../decorators/accept.language';

@UseGuards(AuthGuard())
@Controller('client-packages')
export class ClientPackagesController {
  constructor(private readonly clientPackagesService: ClientPackagesService) {}

  @Post()
  create(
    @Body('phone') phone: string,
    @Query('packageId') packageId: string,
    @Lang() lang: Language,
  ) {
    return this.clientPackagesService.create(packageId, phone, lang);
  }

  @Get()
  findAll(@Lang() language: Language) {
    return this.clientPackagesService.findAll(language);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Lang() language: Language) {
    return this.clientPackagesService.findOne(id, language);
  }

  @Patch(':id')
  update(@Param('id') id: string) {
    return this.clientPackagesService.update(+id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientPackagesService.remove(id);
  }
}
