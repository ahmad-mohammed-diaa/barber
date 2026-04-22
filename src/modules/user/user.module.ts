import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AuthModule } from '../auth/auth.module';
import { UserQueryService } from './services/user-query.service';
import { UserMutationService } from './services/user-mutation.service';
import { UserRatingService } from './services/user-rating.service';

@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [
    UserService,
    UserQueryService,
    UserMutationService,
    UserRatingService,
  ],
})
export class UserModule {}
