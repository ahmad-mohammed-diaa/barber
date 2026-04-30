import { PartialType } from '@nestjs/mapped-types';
import { Role } from '@prisma/client';
import { User as PrismaUserType } from '@prisma/client';

const data = {
  [Role.USER]: {
    referralCode: true,
    points: true,
  },
  [Role.BARBER]: { branch: true },
  [Role.CASHIER]: { branch: true },
  [Role.ADMIN]: { admin: false },
};

export const UserSelect = (Role?: Role) => ({
  select: {
    id: true,
    firstName: true,
    lastName: true,
    phone: true,
    role: true,
    avatar: true,
    createdAt: true,
    updatedAt: true,
    fcmToken: true,
    [Role === 'USER' ? 'client' : Role.toLowerCase()]: {
      select: data[Role],
    },
  },
});

export class UserType implements Partial<PrismaUserType> {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  role;
  avatar: string;
  createdAt: Date;
  updatedAt: Date;
  fcmToken: string;
}

export class ClientType {
  client: {
    referralCode: string;
    points: number;
  };
}

export class BarberType {
  barber: {
    branchId: string;
  };
}

export class CashierType {
  cashier: {
    branchId: string;
  };
}
