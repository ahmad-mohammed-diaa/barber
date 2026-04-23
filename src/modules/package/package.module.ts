import { Module } from '@nestjs/common';
import { PackageService } from './package.service';
import { PackageController } from './package.controller';
import { PackageQueryService } from './services/package-query.service';
import { PackageMutationService } from './services/package-mutation.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [PackageController],
  providers: [PackageService, PackageQueryService, PackageMutationService],
})
export class PackageModule {}
