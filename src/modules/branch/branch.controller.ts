import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../common/config/multer.config';
import { Lang } from '../../common/decorators/accept.language';
import { CategoryType, Language } from '@prisma/client';
import { AuthGuard } from '../../common/guard/auth.guard';
import { RolesGuard } from '../../common/guard/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import {
  CreateBranchDoc,
  FindAllBranchesDoc,
  FindOneBranchDoc,
  UpdateBranchDoc,
  DeleteBranchDoc,
} from './branch.swagger';

@ApiTags('Branch')
@Controller('branch')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Post()
  @UseInterceptors(FileInterceptor('file', multerConfig('branches')))
  @ResponseMessage('Branch created successfully')
  @CreateBranchDoc()
  create(
    @Body() createBranchDto: CreateBranchDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.branchService.create(createBranchDto, file);
  }

  @UseGuards(AuthGuard(false))
  @Get()
  @ResponseMessage('Branches found successfully')
  @FindAllBranchesDoc()
  findAll(@Lang() language: Language) {
    return this.branchService.findAll(language);
  }

  @UseGuards(AuthGuard(false))
  @Get(':id')
  @ResponseMessage('Branch found successfully')
  @FindOneBranchDoc()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Lang() language: Language,
    @Query('type') type: CategoryType,
  ) {
    return this.branchService.findOne(id, type, language);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @UseInterceptors(FileInterceptor('file', multerConfig('branches')))
  @Put(':id')
  @ResponseMessage('Branch updated successfully')
  @UpdateBranchDoc()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBranchDto: UpdateBranchDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.branchService.update(id, updateBranchDto, file);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN'])
  @Delete(':id')
  @DeleteBranchDoc()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchService.remove(id);
  }
}
