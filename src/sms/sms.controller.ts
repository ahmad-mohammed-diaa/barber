import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { SmsService } from './sms.service';
import { multerConfig } from '../common/config/multer.config';
import { FileInterceptor } from '@nestjs/platform-express';
import { RegisterDto } from '../modules/auth/dto/auth-register-dto';

@Controller('sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @UseInterceptors(FileInterceptor('file', multerConfig('avatars')))
  @Post()
  create(
    @Body() body: RegisterDto & { type?: 'register' | 'reset' },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.smsService.sendVerificationCode(body);
  }

  @Post('password-reset')
  resetPassword(@Body('phone') phone: string) {
    return this.smsService.sendResetPassword(phone);
  }

  @UseInterceptors(FileInterceptor('file', multerConfig('avatars')))
  @Post('/verify')
  verifyCode(@Body() body: any, @UploadedFile() file: Express.Multer.File) {
    return this.smsService.verifyCode(body, file);
  }

  @Post('/verify-reset')
  verifyResetCode(
    @Body()
    body: {
      phone: string;
      code: string;
      password: string;
      confirmPassword: string;
    },
  ) {
    return this.smsService.verifyResetCode(body);
  }

  @Post('/resend-register-code')
  resendRegistrationCode(@Body('phone') phone: string) {
    return this.smsService.reSendRegistrationOTP(phone);
  }
  @Post('/resend-reset-password-code')
  resendResetPasswordCode(@Body('phone') phone: string) {
    return this.smsService.reSendResetPasswordOTP(phone);
  }
}
