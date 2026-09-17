import {
  Logger,
  ValidationError,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';

function extractFirstError(errors: ValidationError[]): string | undefined {
  for (const error of errors) {
    const found = depthFirst(error);
    if (found) return found;
  }
  return undefined;
}

function depthFirst(error: ValidationError): string | undefined {
  if (error.constraints) {
    const keys = Object.keys(error.constraints);
    if (keys.length > 0) return error.constraints[keys[0]];
  }
  if (error.children?.length) {
    for (const child of error.children) {
      const found = depthFirst(child);
      if (found) return found;
    }
  }
  return undefined;
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
    allowedHeaders: [
      'Authorization',
      'Accept-Language',
      'Content-Type',
      'x-lang',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });
  app.use(cookieParser());
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors: ValidationError[]) => {
        const first = extractFirstError(errors);
        return new BadRequestException(first ?? 'common.errors.bad_request');
      },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Smart CV SaaS API')
    .setDescription(
      'Unified v1 SaaS pipeline — JWT authentication (register / login / me), account, subscription & credit management, and end-to-end CV-vs-job analysis (extract → Gemini parse → match score → tailored CV advice) with atomic credit deduction.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Access token issued by POST /api/v1/auth/register or POST /api/v1/auth/login',
      },
      'access-token',
    )
    .addTag('auth', 'Register, login and current-account profile')
    .addTag(
      'users',
      'Account details, credit balance and SUPER_ADMIN administration',
    )
    .addTag('analysis', 'CV-vs-job evaluation pipeline and per-account history')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  try {
    const prisma = app.get(PrismaService, { strict: false });
    await prisma.$connect();
    logger.log('Database connected successfully');
  } catch (error) {
    logger.error(`Database connection error: ${(error as Error).message}`);
  }

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 3000);
  await app.listen(port);
  logger.log(`Application running on port ${port} | docs: /api/docs`);
}
bootstrap();
