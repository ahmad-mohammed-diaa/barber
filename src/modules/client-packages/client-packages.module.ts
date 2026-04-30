import { Module } from '@nestjs/common';
import { ClientPackagesService } from './client-packages.service';
import { ClientPackagesController } from './client-packages.controller';
import { ClientPackagesQueryService } from './services/client-packages-query.service';
import { ClientPackagesMutationService } from './services/client-packages-mutation.service';

@Module({
  controllers: [ClientPackagesController],
  providers: [
    ClientPackagesService,
    ClientPackagesQueryService,
    ClientPackagesMutationService,
  ],
  exports: [ClientPackagesService, ClientPackagesQueryService],
})
export class ClientPackagesModule {}
