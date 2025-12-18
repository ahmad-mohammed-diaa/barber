import {
  Controller,
  Post,
  Body,
  Patch,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  ConflictException,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/auth-login-dto';
import { RegisterDto } from './dto/auth-register-dto';
import { AuthGuard } from 'guard/auth.guard';
import { UserData } from 'decorators/user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../src/config/multer.config';
import { AppSuccess } from 'src/utils/AppSuccess';
import { Roles } from 'decorators/roles.decorator';
import { RolesGuard } from 'guard/role.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/signup')
  @UseInterceptors(FileInterceptor('file', multerConfig('avatars')))
  signup(
    @Body() createAuthDto: RegisterDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.authService.signup(createAuthDto, file);
  }

  @Post('/login')
  login(@Body() createAuthDto: LoginDto) {
    return this.authService.login(createAuthDto);
  }

  @Post('/logout')
  @UseGuards(AuthGuard())
  logout(@UserData('token') token: string) {
    return this.authService.logout(token);
  }

  @Post('/referral-code')
  checkReferralCode(@Body('referralCode') referralCode: string) {
    const isCodeValid = this.authService.checkReferralCode(referralCode);
    if (!isCodeValid) {
      throw new ConflictException('Referral Code is not valid');
    }
    return new AppSuccess(
      { referralCode: isCodeValid },
      'Referral Code is Applying',
    );
  }

  @UseGuards(AuthGuard())
  @Patch('/change-password/:id')
  changePassword(@Param('id') id: string, @Body('password') password: string) {
    return this.authService.changePassword(id, password);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN', 'CASHIER'])
  @Patch('/reset-password')
  resetPassword(@Body('phone') phone: string) {
    return this.authService.resetPassword(phone);
  }
}
