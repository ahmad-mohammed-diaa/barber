import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthSlotService } from './services/auth-slot.service';
import { ReferralCodeService } from './services/referral-code.service';
import { CreateUserService } from './services/create-user.service';
import { TokenOperationsService } from './services/token-operations.service';
import { AuthSignupService } from './services/auth-signup.service';
import { AuthLoginService } from './services/auth-login.service';
import { AuthPasswordService } from './services/auth-password.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSignupService,
    AuthLoginService,
    AuthPasswordService,
    AuthSlotService,
    ReferralCodeService,
    CreateUserService,
    TokenOperationsService,
  ],
  exports: [AuthService, AuthSlotService, TokenOperationsService],
})
export class AuthModule {}
