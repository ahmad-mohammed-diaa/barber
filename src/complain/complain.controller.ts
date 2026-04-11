import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Put,
} from '@nestjs/common';
import { ComplainService } from './complain.service';
import { CreateComplainDto } from './dto/create-complain.dto';
import { UserData } from '../../decorators/user.decorator';
import { User } from '@prisma/client';
import { AuthGuard } from '../../guard/auth.guard';
import { RolesGuard } from '../../guard/role.guard';
import { Roles } from '../../decorators/roles.decorator';

@Controller('complain')
@UseGuards(AuthGuard(), RolesGuard)
export class ComplainController {
  constructor(private readonly complainService: ComplainService) {}

  @Roles(['USER', 'ADMIN'])
  @Post()
  create(
    @Body() createComplainDto: CreateComplainDto,
    @UserData('user') user: User,
  ) {
    return this.complainService.createComplain(createComplainDto, user);
  }

  @Roles(['ADMIN'])
  @Get()
  findAll() {
    return this.complainService.getAllComplains();
  }

  @Roles(['ADMIN'])
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.complainService.findOne(id);
  }

  @Roles(['ADMIN'])
  @Put(':id')
  update(@Param('id') id: string) {
    return this.complainService.updateComplain(id);
  }

  @Roles(['ADMIN'])
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.complainService.remove(id);
  }
}
