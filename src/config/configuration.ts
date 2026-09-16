import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? '',
    model: process.env.GEMINI_MODEL ?? 'gemini-3.6-flash',
  },
  i18n: {
    fallbackLanguage: process.env.FALLBACK_LANGUAGE ?? 'en',
  },
  credits: {
    freeTrial: parseInt(process.env.FREE_TRIAL_CREDITS ?? '5', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'smart-cv-dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10),
  },
}));
