import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdminQueryService } from './services/admin-query.service';
import { AdminMutationService } from './services/admin-mutation.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly adminQuery: AdminQueryService,
    private readonly adminMutation: AdminMutationService,
  ) {}

  create(createAdminDto: CreateAdminDto) {
    return this.adminMutation.create(createAdminDto);
  }

  findAll() {
    return this.adminQuery.findAll();
  }

  update(updateAdminDto: UpdateAdminDto) {
    return this.adminMutation.update(updateAdminDto);
  }

  getBarberOrdersWithCounts(role: Role, fromDate?: Date, toDate?: Date) {
    return this.adminQuery.getBarberOrdersWithCounts(role, fromDate, toDate);
  }

  CheckPassword(password: string) {
    return this.adminMutation.CheckPassword(password);
  }
}
