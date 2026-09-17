import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import {
  ValidationPipe,
  BadRequestException,
  ValidationError,
} from '@nestjs/common';
import * as path from 'path';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { I18nResponseInterceptor } from './common/interceptors/i18n-response.interceptor';
import { AiModule } from './modules/ai/ai.module';
import { ParserModule } from './modules/parser/parser.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { AuthModule } from './modules/auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validationSchema: envValidationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    ScheduleModule.forRoot(),
    I18nModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        fallbackLanguage: config.get<string>('app.i18n.fallbackLanguage', 'en'),
        loaderOptions: {
          path: path.join(__dirname, '/i18n/'),
          watch: true,
        },
        typesOutputPath: path.join(process.cwd(), 'src/i18n/i18n.generated.ts'),
      }),
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        new HeaderResolver(['x-lang', 'Accept-Language']),
      ],
      inject: [ConfigService],
    }),
    PrismaModule,
    AiModule,
    ParserModule,
    AuthModule,
    AnalysisModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: I18nResponseInterceptor,
    },
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
          transformOptions: { enableImplicitConversion: true },
          exceptionFactory: (errors: ValidationError[]) => {
            const first = extractFirstError(errors);
            return new BadRequestException(
              first ?? 'common.errors.bad_request',
            );
          },
        }),
    },
  ],
})
export class AppModule {}

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
  if (error.children && error.children.length > 0) {
    for (const child of error.children) {
      const found = depthFirst(child);
      if (found) return found;
    }
  }
  return undefined;
}
