import { Injectable } from '@nestjs/common';
import { Language } from '@prisma/client';
import { ClientPackagesQueryService } from './services/client-packages-query.service';
import { ClientPackagesMutationService } from './services/client-packages-mutation.service';

@Injectable()
export class ClientPackagesService {
  constructor(
    private readonly clientPackagesQuery: ClientPackagesQueryService,
    private readonly clientPackagesMutation: ClientPackagesMutationService,
  ) {}

  create(packageId: string, phone: string, language: Language) {
    return this.clientPackagesMutation.create(packageId, phone, language);
  }

  findAll(language: Language) {
    return this.clientPackagesQuery.findAll(language);
  }

  findOne(id: string, language: Language) {
    return this.clientPackagesQuery.findOne(id, language);
  }

  update(id: string) {
    return this.clientPackagesMutation.update(id);
  }

  remove(id: string) {
    return this.clientPackagesMutation.remove(id);
  }
}
