import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import axios from 'axios';
import { RegisterDto } from 'src/auth/dto/auth-register-dto';
import { AuthService } from 'src/auth/auth.service';
import { hash } from 'bcrypt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppSuccess } from 'src/utils/AppSuccess';
import { User } from '@prisma/client';

@Injectable()
export class SmsService {
  private readonly username: string;
  private readonly password: string;
  private readonly senderName: string;
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {
    this.senderName = process.env.SMS_SENDER_NAME;
    this.username = process.env.SMS_USERNAME;
    this.password = process.env.SMS_PASSWORD;
  }

  // At the top of the class
  private otpStore = new Map<
    string,
    { lastSent: number; resendCount: number; countExpiresAt: number }
  >();

  private limit(phone: string, now: number) {
    const cooldown = 60 * 1000; // 60 seconds
    const maxResends = 3;
    const windowDuration = 15 * 60 * 1000; // 15 minutes

    const existing = this.otpStore.get(phone);

    // Reset resend count if window expired
    if (existing && existing.countExpiresAt && now > existing.countExpiresAt) {
      existing.resendCount = 0;
      existing.countExpiresAt = now + windowDuration;
    }

    // Check cooldown
    if (existing && now - existing.lastSent < cooldown) {
      const wait = Math.ceil((cooldown - (now - existing.lastSent)) / 1000);
      throw new ConflictException(`Please wait ${wait}s before resending OTP`);
    }

    // Check resend limit
    if (existing && existing.resendCount >= maxResends) {
      throw new ConflictException('Maximum OTP resend attempts reached');
    }
  }

  private async sendSMS({ phone, code }: { phone: string; code?: string }) {
    const message = `[NAEMAN] Your verification code is: ${code}.
It expires in 5 minutes. Do not share this code with anyone.
`;

    const url = `${process.env.SMS_API_URL}?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}&sendername=${this.senderName}&message=${encodeURIComponent(message)}&mobiles=2${phone}`;

    try {
      await axios.post(url, null, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Language': 'en-US',
        },
      });
    } catch (error) {
      this.logger.error(`Error sending SMS: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to send SMS');
    }
  }

  async sendVerificationCode(body: RegisterDto) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const userExists = await this.prisma.user.findUnique({
      where: { phone: body.phone },
    });
    if (userExists && !userExists.deleted) {
      throw new ConflictException('User already exists with this phone number');
    }
    try {
      await this.prisma.phoneVerification.upsert({
        where: { phone: body.phone },
        update: {
          code,
          expiredAt: new Date(Date.now() + 5 * 60 * 1000),
        },
        create: {
          phone: body.phone,
          code,
          expiredAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
      await this.sendSMS({ phone: body.phone, code });
      return new AppSuccess(body, 'Verification Code sent successfully');
    } catch (e) {
      if (e instanceof ConflictException || e instanceof NotFoundException) {
        throw e;
      }

      const error = e as Error;
      this.logger.error(`Error sending SMS: ${error.message}`, error.stack);
    }
  }

  async sendResetPassword(phone: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const user = this.prisma.user.findUnique({
      where: { phone: phone },
    });

    if (!user) {
      throw new NotFoundException('User not found with this phone number');
    }

    try {
      await this.prisma.resetPassword.upsert({
        where: { phone: phone },
        update: {
          code,
          expiredAt: new Date(Date.now() + 5 * 60 * 1000),
        },
        create: {
          phone: phone,
          code,
          expiredAt: new Date(Date.now() + 5 * 60 * 1000),
        },
      });
      await this.sendSMS({ phone: phone, code });
      return new AppSuccess(null, 'Verification Code sent successfully');
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        `Error sending reset password SMS: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to send reset password SMS',
      );
    }
  }

  async verifyCode(
    body: RegisterDto & { code: string },
    file?: Express.Multer.File,
  ) {
    const { phone, code, ...rest } = body;

    const verification = await this.prisma.phoneVerification.findUnique({
      where: { phone },
    });

    if (!code) {
      throw new ConflictException('Verification code is required');
    }

    if (!verification) {
      throw new ConflictException('Invalid verification code');
    }

    if (verification.code !== code || new Date() > verification.expiredAt) {
      throw new ConflictException('Invalid verification code');
    }
    return await this.authService.signup({ phone, ...rest }, file);
  }

  async verifyResetCode(body: {
    phone: string;
    code: string;
    password: string;
    confirmPassword: string;
  }): Promise<{
    data: User;
    token: string;
    message: string;
    statusCode: number;
  }> {
    const { phone, code, password, confirmPassword } = body;
    const verification = await this.prisma.resetPassword.findUnique({
      where: { phone },
    });

    if (!code) {
      throw new ConflictException('Reset code is required');
    }

    if (!verification) {
      throw new NotFoundException(
        'No reset request found for this phone number',
      );
    }

    if (verification.code !== code) {
      throw new ConflictException('Invalid code');
    }

    if (new Date() > verification.expiredAt) {
      throw new ConflictException('code has expired');
    }

    if (password !== confirmPassword) {
      throw new ConflictException('Passwords do not match');
    }

    const user = await this.prisma.user.update({
      where: { phone },
      data: {
        password: await hash(password, 10),
      },
    });

    const token = await this.authService.generateToken(user.id);

    return {
      data: user,
      token,
      message: 'password reset successfully',
      statusCode: 201,
    };
  }

  async reSendRegistrationOTP(phone: string) {
    const now = Date.now();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.limit(phone, now);

    try {
      await this.sendSMS({ phone, code });

      await this.prisma.phoneVerification.upsert({
        where: { phone },
        update: { code, expiredAt: new Date(now + 5 * 60 * 1000) },
        create: {
          phone,
          code,
          expiredAt: new Date(now + 5 * 60 * 1000),
        },
      });

      return { message: 'Message resent successfully' };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(`Error resending OTP: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to resend OTP');
    }
  }
  async reSendResetPasswordOTP(phone: string) {
    const now = Date.now();
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.limit(phone, now);

    try {
      await this.sendSMS({ phone, code });

      await this.prisma.resetPassword.upsert({
        where: { phone },
        update: { code, expiredAt: new Date(now + 5 * 60 * 1000) },
        create: {
          phone,
          code,
          expiredAt: new Date(now + 5 * 60 * 1000),
        },
      });

      return { message: 'Message resent successfully' };
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      this.logger.error(`Error resending OTP: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Failed to resend OTP');
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  handleOtpCleanup() {
    const now = Date.now();
    for (const [phone, data] of this.otpStore.entries()) {
      if (data.countExpiresAt < now) {
        this.otpStore.delete(phone);
        console.log(`[OTP Cleanup] Removed expired OTP for ${phone}`);
      }
    }
  }
}
