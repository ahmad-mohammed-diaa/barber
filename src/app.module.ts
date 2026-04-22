import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { PrismaModule } from './prisma/prisma.module';
import { CategoryModule } from './modules/category/category.module';
import { ServiceModule } from './modules/service/service.module';
import { OrderModule } from './modules/order/order.module';
import { BranchModule } from './modules/branch/branch.module';
import { PromoCodeModule } from './modules/promo-code/promo-code.module';
import { ScheduleModule } from '@nestjs/schedule';
import { TokenService } from './token.service';
import { ComplainModule } from './modules/complain/complain.module';
import { ConfigModule } from '@nestjs/config';
import { PointsModule } from './modules/points/points.module';
import { MockModule } from './mock/mock.module';
import { PackageModule } from './modules/package/package.module';
import { ClientPackagesModule } from './modules/client-packages/client-packages.module';
import { PaymobModule } from './paymob/paymob.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ProductModule } from './modules/product/product.module';
import { StaticModule } from './modules/static/static.module';
import { AdminModule } from './modules/admin/admin.module';
import { SmsModule } from './sms/sms.module';
// import { NotificationScheduler } from './modules/notification/services/notificationScheduler';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    UserModule,
    PrismaModule,
    PackageModule,
    CategoryModule,
    ServiceModule,
    OrderModule,
    BranchModule,
    PromoCodeModule,
    ScheduleModule.forRoot(),
    ComplainModule,
    ClientPackagesModule,
    PointsModule,
    PaymobModule,
    NotificationModule,
    MockModule,
    ProductModule,
    StaticModule,
    AdminModule,
    SmsModule,
  ],
  controllers: [],
  providers: [
    TokenService,
    // NotificationScheduler,
    { provide: APP_INTERCEPTOR, useClass: TransformResponseInterceptor },
  ],
})
export class AppModule {}
