import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminQueryService } from './services/admin-query.service';
import { AdminMutationService } from './services/admin-mutation.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminQueryService, AdminMutationService],
  exports: [AdminService],
})
export class AdminModule {}
