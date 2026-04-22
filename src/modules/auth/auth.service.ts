import { Global, Injectable } from '@nestjs/common';
import { RegisterDto } from './dto/auth-register-dto';
import { LoginDto } from './dto/auth-login-dto';
import { AuthSignupService } from './services/auth-signup.service';
import { AuthLoginService } from './services/auth-login.service';
import { AuthPasswordService } from './services/auth-password.service';
import { ReferralCodeService } from './services/referral-code.service';
import { TokenOperationsService } from './services/token-operations.service';

@Global()
@Injectable()
export class AuthService {
  constructor(
    private readonly authSignup: AuthSignupService,
    private readonly authLogin: AuthLoginService,
    private readonly authPassword: AuthPasswordService,
    private readonly authReferral: ReferralCodeService,
    private readonly tokenOps: TokenOperationsService,
  ) {}

  signup(dto: RegisterDto, file: Express.Multer.File) {
    return this.authSignup.signup(dto, file);
  }

  login(dto: LoginDto) {
    return this.authLogin.login(dto);
  }

  logout(token: string) {
    return this.authLogin.logout(token);
  }

  verifyToken(token: string) {
    return this.tokenOps.verifyToken(token);
  }

  generateToken(userId: string) {
    return this.tokenOps.generateToken(userId);
  }

  checkReferralCode(referralCode: string) {
    return this.authReferral.checkReferralCode(referralCode);
  }

  changePassword(id: string, password: string) {
    return this.authPassword.changePassword(id, password);
  }

  resetPassword(phone: string) {
    return this.authPassword.resetPassword(phone);
  }
}
