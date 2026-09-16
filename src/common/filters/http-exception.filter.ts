import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';

/**
 * Global error handler. Success bodies are localized by
 * `I18nResponseInterceptor`; this filter applies the same treatment to error
 * payloads, so thrown i18n keys (e.g. `auth.errors.forbidden`) are returned in
 * the requested language.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private static readonly I18N_KEY = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/i;

  constructor(private readonly i18n: I18nService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const res: unknown =
      exception instanceof HttpException ? exception.getResponse() : null;

    const rawMessage: unknown = this.extractMessage(res);

    const message: unknown = await this.localize(rawMessage, host, request);
    const extras: Record<string, unknown> = this.exceptionDetails(res);

    this.logger.error(
      `${request.method} ${request.url} -> ${status}: ${JSON.stringify(message)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      statusCode: status,
      message,
      ...extras,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  /**
   * Extra fields carried by the exception payload (e.g. `creditsRemaining` on
   * `PaymentRequiredException`), excluding the fields this filter owns.
   */
  private exceptionDetails(res: unknown): Record<string, unknown> {
    if (!res || typeof res !== 'object') {
      return {};
    }
    return Object.fromEntries(
      Object.entries(res as Record<string, unknown>).filter(
        ([key]) => !['statusCode', 'message', 'error'].includes(key),
      ),
    );
  }

  /** Extracts the message of a Nest exception payload (string or object). */
  private extractMessage(res: unknown): unknown {
    if (typeof res === 'string') {
      return res;
    }
    if (res && typeof res === 'object' && 'message' in res) {
      return (
        (res as { message?: unknown }).message ??
        'common.errors.internal_server_error'
      );
    }
    return 'common.errors.internal_server_error';
  }

  /** Translates i18n keys, passing through anything else unchanged. */
  private async localize(
    message: unknown,
    host: ArgumentsHost,
    request: Request,
  ): Promise<unknown> {
    if (
      typeof message !== 'string' ||
      !HttpExceptionFilter.I18N_KEY.test(message)
    ) {
      return message;
    }

    const i18nContext = I18nContext.current(host);
    const i18nLang: unknown = i18nContext?.lang;
    const headerLang: unknown = request.headers['x-lang'];
    const lang: string =
      (typeof i18nLang === 'string' && i18nLang) ||
      (typeof headerLang === 'string' && headerLang) ||
      'en';

    try {
      return await this.i18n.translate(message, { lang });
    } catch {
      return message;
    }
  }
}
