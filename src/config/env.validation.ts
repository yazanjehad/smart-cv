import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  GEMINI_API_KEY: Joi.string().allow('').optional(),
  GEMINI_MODEL: Joi.string().default('gemini-3.6-flash'),
  FALLBACK_LANGUAGE: Joi.string().default('en'),
  FREE_TRIAL_CREDITS: Joi.number().integer().min(0).default(5),
});
