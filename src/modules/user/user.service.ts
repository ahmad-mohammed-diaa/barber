import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { UserQueryService } from './services/user-query.service';
import { UserMutationService } from './services/user-mutation.service';
import { UserRatingService } from './services/user-rating.service';
import { UserUpdateDto } from './dto/user-update-dto';
import { RateBarberDto } from './dto/rate-barber.dto';
import { FindAllUsersDto } from './dto/find-all-users.dto';
import { FindAllClientsDto } from './dto/find-all-clients.dto';

@Injectable()
export class UserService {
  constructor(
    private readonly userQuery: UserQueryService,
    private readonly userMutation: UserMutationService,
    private readonly userRating: UserRatingService,
  ) {}

  findAllUser({ page, pageSize, role }: FindAllUsersDto) {
    return this.userQuery.findAllUser(page, pageSize, role);
  }

  findAllClients({ page, pageSize, phone }: FindAllClientsDto) {
    return this.userQuery.findAllClients(page, pageSize, phone);
  }

  findOneUser(id: string) {
    return this.userQuery.findOneUser(id);
  }

  currentUser(user: User) {
    return this.userQuery.currentUser(user);
  }

  updateUser(id: string, userData: UserUpdateDto, file?: Express.Multer.File) {
    return this.userMutation.updateUser(id, userData, file);
  }

  updateBarberAvailability(id: string) {
    return this.userMutation.updateBarberAvailability(id);
  }

  unbanUser(phone: string) {
    return this.userMutation.unbanUser(phone);
  }

  deleteUser(userId: string) {
    return this.userMutation.deleteUser(userId);
  }

  deleteEmployee(id: string) {
    return this.userMutation.deleteEmployee(id);
  }

  rateBarber({ barberId, orderId, rating }: RateBarberDto, clientId: string) {
    return this.userRating.rateBarber(clientId, barberId, orderId, rating);
  }
}
