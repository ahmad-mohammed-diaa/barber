import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { config } from 'dotenv';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import * as express from 'express';
import { join } from 'path';
import { FirstErrorOnlyFilter } from '../filters/validation-fields-only.filter';
import { NotFoundFilter } from './utils/not-found.filter';

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
