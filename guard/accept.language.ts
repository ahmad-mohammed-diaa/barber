import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AcceptLanguage implements CanActivate {
  constructor() {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const lang = req.headers['accept-language'] || 'EN';
    return lang;
  }
  catch(error) {
    throw new UnauthorizedException('Invalid ');
  }
}
