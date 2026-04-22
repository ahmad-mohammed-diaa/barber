import { Injectable } from '@nestjs/common';
import { CreatePackageDto } from './dto/create-package.dto';
import { PackageQueryService } from './services/package-query.service';
import { PackageMutationService } from './services/package-mutation.service';
import { Language } from '@prisma/client';

@Injectable()
export class PackageService {
  constructor(
    private readonly packageQuery: PackageQueryService,
    private readonly packageMutation: PackageMutationService,
  ) {}

  create(createPackageDto: CreatePackageDto, file: Express.Multer.File) {
    return this.packageMutation.create(createPackageDto, file);
  }

  findAll(language: Language) {
    return this.packageQuery.findAll(language);
  }

  findOne(id: string, language: Language) {
    return this.packageQuery.findOne(id, language);
  }

  update(id: string) {
    return this.packageMutation.update(id);
  }

  remove() {
    return this.packageMutation.remove();
  }
}
