import {
  Controller,
  Post,
  Body,
  Patch,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/auth-login-dto';
import { RegisterDto } from './dto/auth-register-dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ReferralCodeDto } from './dto/referral-code.dto';
import { AuthGuard } from '../../common/guard/auth.guard';
import { UserData } from '../../common/decorators/user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '../../common/config/multer.config';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guard/role.guard';
import { ResponseMessage } from '../../common/decorators/response-message.decorator';
import {
  SignupDoc,
  LoginDoc,
  LogoutDoc,
  CheckReferralCodeDoc,
  ChangePasswordDoc,
  ResetPasswordDoc,
} from './auth.swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('/signup')
  @SignupDoc()
  @UseInterceptors(FileInterceptor('file', multerConfig('avatars')))
  signup(
    @Body() createAuthDto: RegisterDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.authService.signup(createAuthDto, file);
  }

  @Post('/login')
  @LoginDoc()
  login(@Body() createAuthDto: LoginDto) {
    return this.authService.login(createAuthDto);
  }

  @Post('/logout')
  @LogoutDoc()
  @UseGuards(AuthGuard())
  @ResponseMessage('logout successfully')
  logout(@UserData('token') token: string) {
    return this.authService.logout(token);
  }

  @Post('/referral-code')
  @CheckReferralCodeDoc()
  @ResponseMessage('Referral Code is Applying')
  async checkReferralCode(@Body() { referralCode }: ReferralCodeDto) {
    return this.authService.checkReferralCode(referralCode);
  }

  @UseGuards(AuthGuard())
  @Patch('/change-password/:id')
  @ChangePasswordDoc()
  @ResponseMessage('Password changed successfully')
  changePassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() { password }: ChangePasswordDto,
  ) {
    return this.authService.changePassword(id, password);
  }

  @UseGuards(AuthGuard(), RolesGuard)
  @Roles(['ADMIN', 'CASHIER'])
  @Patch('/reset-password')
  @ResetPasswordDoc()
  @ResponseMessage('Password reset successfully')
  resetPassword(@Body() { phone }: ResetPasswordDto) {
    return this.authService.resetPassword(phone);
  }
}
