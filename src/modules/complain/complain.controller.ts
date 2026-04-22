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
import { ApiTags } from '@nestjs/swagger';
import { User } from '@prisma/client';
import { ComplainService } from './complain.service';
import { CreateComplainDto } from './dto/create-complain.dto';
import { UserData } from '../../../decorators/user.decorator';
import { AuthGuard } from '../../../guard/auth.guard';
import { RolesGuard } from '../../../guard/role.guard';
import { Roles } from '../../../decorators/roles.decorator';
import {
  CreateComplainDoc,
  GetAllComplainsDoc,
  GetComplainByIdDoc,
  UpdateComplainDoc,
  DeleteComplainDoc,
} from './complain.swagger';

@ApiTags('Complain')
@Controller('complain')
@UseGuards(AuthGuard(), RolesGuard)
export class ComplainController {
  constructor(private readonly complainService: ComplainService) {}

  @Roles(['USER', 'ADMIN'])
  @Post()
  @CreateComplainDoc()
  create(
    @Body() createComplainDto: CreateComplainDto,
    @UserData('user') user: User,
  ) {
    return this.complainService.createComplain(createComplainDto, user);
  }

  @Roles(['ADMIN'])
  @Get()
  @GetAllComplainsDoc()
  findAll() {
    return this.complainService.getAllComplains();
  }

  @Roles(['ADMIN'])
  @Get(':id')
  @GetComplainByIdDoc()
  findOne(@Param('id') id: string) {
    return this.complainService.findOne(id);
  }

  @Roles(['ADMIN'])
  @Put(':id')
  @UpdateComplainDoc()
  update(@Param('id') id: string) {
    return this.complainService.updateComplain(id);
  }

  @Roles(['ADMIN'])
  @Delete(':id')
  @DeleteComplainDoc()
  remove(@Param('id') id: string) {
    return this.complainService.remove(id);
  }
}
