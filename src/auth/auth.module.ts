import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthSlotService } from './services/auth-slot.service';
import { ReferralCodeService } from './services/referral-code.service';
import { CreateUserService } from './services/create-user.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSlotService,
    ReferralCodeService,
    CreateUserService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
