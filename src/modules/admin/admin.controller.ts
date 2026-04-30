import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AuthGuard } from '../../common/guard/auth.guard';
import { RolesGuard } from '../../common/guard/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserData } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import {
  CreateAdminDoc,
  FindAllAdminDoc,
  GetAnalyticsDoc,
  UpdateAdminDoc,
  CheckPasswordDoc,
} from './admin.swagger';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(AuthGuard(), RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles(['ADMIN'])
  @Post()
  @CreateAdminDoc()
  create(@Body() createAdminDto: CreateAdminDto) {
    return this.adminService.create(createAdminDto);
  }

  @Roles(['ADMIN'])
  @Get()
  @FindAllAdminDoc()
  findAll() {
    return this.adminService.findAll();
  }

  @Roles(['ADMIN', 'CASHIER'])
  @Get('/analytics')
  @GetAnalyticsDoc()
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
  @UpdateAdminDoc()
  update(@Body() updateAdminDto: UpdateAdminDto) {
    return this.adminService.update(updateAdminDto);
  }

  @Roles(['ADMIN', 'CASHIER'])
  @Post('/check-password')
  @CheckPasswordDoc()
  checkPassword(@Body() body: { password: string }) {
    return this.adminService.CheckPassword(body.password);
  }
}
