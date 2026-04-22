import { Module } from '@nestjs/common';
import { PackageService } from './package.service';
import { PackageController } from './package.controller';
import { PackageQueryService } from './services/package-query.service';
import { PackageMutationService } from './services/package-mutation.service';
import { NotificationService } from 'src/notification/notification.service';

@Module({
  imports: [],
  controllers: [PackageController],
  providers: [
    PackageService,
    PackageQueryService,
    PackageMutationService,
    NotificationService,
  ],
})
export class PackageModule {}
