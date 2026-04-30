import { ApiDoc } from '../../common/lib/swagger';
import { LoginDto } from './dto/auth-login-dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

export const SignupDoc = () =>
  ApiDoc({
    summary: 'Register a new user',
    consumes: 'multipart/form-data',
  });

export const LoginDoc = () =>
  ApiDoc({
    summary: 'Login with phone and password',
    body: LoginDto,
    extraModels: [LoginDto],
  });

export const LogoutDoc = () =>
  ApiDoc({
    summary: 'Logout current user',
    auth: true,
  });

export const CheckReferralCodeDoc = () =>
  ApiDoc({ summary: 'Validate a referral code' });

export const ChangePasswordDoc = () =>
  ApiDoc({
    summary: 'Change password for a user by ID',
    body: ChangePasswordDto,
    extraModels: [ChangePasswordDto],
    auth: true,
  });

export const ResetPasswordDoc = () =>
  ApiDoc({
    summary: 'Reset password to default (Admin/Cashier only)',
    body: ResetPasswordDto,
    extraModels: [ResetPasswordDto],
    auth: true,
  });
