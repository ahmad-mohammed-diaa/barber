import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from 'dotenv';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import * as express from 'express';
import { join } from 'path';
import { FirstErrorOnlyFilter } from '../filters/validation-fields-only.filter';
import { NotFoundFilter } from './utils/not-found.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as AuthDto from './modules/auth/dto';
import * as UserDto from './modules/user/dto';
import * as BranchDto from './modules/branch/dto';
import * as CategoryDto from './modules/category/dto';
import * as ServiceDto from './modules/service/dto';
import * as OrderDto from './modules/order/dto';

config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  app.use(express.static(join(__dirname, '..', 'public')));
  const prismaService = app.get(PrismaService);
  await prismaService.onModuleInit();
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Barber Shop API')
    .setDescription('Barber Shop Management System')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    extraModels: [
      ...Object.values(AuthDto),
      ...Object.values(UserDto),
      ...Object.values(BranchDto),
      ...Object.values(CategoryDto),
      ...Object.values(ServiceDto),
      ...Object.values(OrderDto),
    ],
  });
  SwaggerModule.setup('api/docs', app, document);

  app.useGlobalFilters(new NotFoundFilter());
  app.useGlobalFilters(new FirstErrorOnlyFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      forbidUnknownValues: false,
      whitelist: true,
      exceptionFactory: (data) => {
        return new BadRequestException(data);
      },
    }),
  );
  await app.listen(process.env.PORT ?? 8080, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
  });
}

bootstrap();
