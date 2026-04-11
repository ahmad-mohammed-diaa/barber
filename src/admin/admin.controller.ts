import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AuthGuard } from '../../guard/auth.guard';
import { RolesGuard } from '../../guard/role.guard';
import { Roles } from '../../decorators/roles.decorator';
import { UserData } from '../../decorators/user.decorator';
import { User } from '@prisma/client';

@Controller('admin')
@UseGuards(AuthGuard(), RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles(['ADMIN'])
  @Post()
  create(@Body() createAdminDto: CreateAdminDto) {
    return this.adminService.create(createAdminDto);
  }

  @Roles(['ADMIN'])
  @Get()
  findAll() {
    return this.adminService.findAll();
  }

  @Roles(['ADMIN', 'CASHIER'])
  @Get('/analytics')
  getAnalytics(
    @UserData('user') { role }: User,
    @Query() { fromDate, toDate }: { fromDate?: string; toDate?: string },
  ) {
    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;
    return this.adminService.getBarberOrdersWithCounts(role, from, to);
  }

  @Roles(['ADMIN'])
  @Put()
  update(@Body() updateAdminDto: UpdateAdminDto) {
    return this.adminService.update(updateAdminDto);
  }

  @Roles(['ADMIN', 'CASHIER'])
  @Post('/check-password')
  checkPassword(@Body() body: { password: string }) {
    return this.adminService.CheckPassword(body.password);
  }
}
