import {
  Controller,
  Get,
  Body,
  Param,
  Delete,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Put,
  Post,
  ParseUUIDPipe,
  Query,
  Patch,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserService } from './user.service';
import { AuthGuard } from '../../common/guard/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserUpdateDto } from './dto/user-update-dto';
import { RateBarberDto } from './dto/rate-barber.dto';
import { FindAllUsersDto } from './dto/find-all-users.dto';
import { FindAllClientsDto } from './dto/find-all-clients.dto';
import { UserData } from '../../common/decorators/user.decorator';
import { User } from '@prisma/client';
import { multerConfig } from '../../common/config/multer.config';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import {
  FindAllUsersDoc,
  FindAllClientsDoc,
  UpdateUserDoc,
  UpdateBarberAvailabilityDoc,
  FindOneUserDoc,
  CurrentUserDoc,
  DeleteAccountDoc,
  DeleteEmployeeDoc,
  RateBarberDoc,
  UnbanUserDoc,
} from './user.swagger';

@ApiTags('User')
@Controller('user')
@UseGuards(AuthGuard())
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Put('unban')
  @UnbanUserDoc()
  @ResponseMessage('User unbanned successfully')
  unbanUser(@Body('number') number: string) {
    return this.userService.unbanUser(number);
  }

  @Get()
  @FindAllUsersDoc()
  @ResponseMessage('Users fetched successfully')
  findAll(@Query() query: FindAllUsersDto) {
    return this.userService.findAllUser(query);
  }

  @Get('clients')
  @FindAllClientsDoc()
  @ResponseMessage('Clients fetched successfully')
  findAllClients(@Query() query: FindAllClientsDto) {
    return this.userService.findAllClients(query);
  }

  // current/profile must be BEFORE :id to avoid NestJS matching "current" as a UUID
  @Get('current/profile')
  @CurrentUserDoc()
  @ResponseMessage('User fetched successfully')
  currentUser(@UserData('user') user: User) {
    return this.userService.currentUser(user);
  }

  @Get(':id')
  @FindOneUserDoc()
  @ResponseMessage('User fetched successfully')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findOneUser(id);
  }

  @Put(':id')
  @UpdateUserDoc()
  @ResponseMessage('User updated successfully')
  @UseInterceptors(FileInterceptor('file', multerConfig('avatars')))
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() user: UserUpdateDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.userService.updateUser(id, user, file);
  }

  @Patch('barber-availability/:id')
  @UpdateBarberAvailabilityDoc()
  updateBarberAvailability(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.updateBarberAvailability(id);
  }

  @Delete('deleteAccount')
  @DeleteAccountDoc()
  @ResponseMessage('User deleted successfully')
  delete(@UserData('user') user: User) {
    return this.userService.deleteUser(user.id);
  }

  @Delete('deleteEmployeeAccount/:id')
  @DeleteEmployeeDoc()
  @ResponseMessage('Employee deleted successfully')
  deleteEmployee(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.deleteEmployee(id);
  }

  @Post('rate-barber')
  @RateBarberDoc()
  @ResponseMessage('Barber rated successfully')
  rateBarber(
    @UserData('user') user: User,
    @Body() rateBarberDto: RateBarberDto,
  ) {
    return this.userService.rateBarber(rateBarberDto, user.id);
  }
}
