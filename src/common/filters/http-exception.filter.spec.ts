import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { PaymentRequiredException } from '../exceptions/payment-required.exception';
import { HttpExceptionFilter } from './http-exception.filter';

/** Minimal Express host double capturing status()/json(). */
function createHost(headers: Record<string, string> = {}) {
  const json = jest.fn<void, [Record<string, unknown>]>();
  const status = jest.fn<{ json: typeof json }, [number]>().mockReturnValue({
    json,
  });
  const host = {
    getType: () => 'http',
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        url: '/api/v1/analysis/evaluate',
        headers,
      }),
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

/** Filter wired to a stubbed I18nService (returns `translated:<key>`). */
function createFilter(
  translate: (key: string) => string = (key: string) => `translated:${key}`,
) {
  const translateMock = jest.fn<string, [string]>(translate);
  const i18n = { translate: translateMock } as unknown as I18nService;

  return { filter: new HttpExceptionFilter(i18n), translate: translateMock };
}

describe('HttpExceptionFilter', () => {
  it('localizes an i18n key thrown by a guard/service', async () => {
    const { filter, translate } = createFilter();
    const { host, status, json } = createHost({ 'x-lang': 'ar' });

    await filter.catch(new NotFoundException('users.errors.not_found'), host);

    expect(translate).toHaveBeenCalledWith('users.errors.not_found', {
      lang: 'ar',
    });
    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
        message: 'translated:users.errors.not_found',
        path: '/api/v1/analysis/evaluate',
      }),
    );
  });

  it('keeps the extra 402 context (creditsRemaining) in the body', async () => {
    const { filter } = createFilter();
    const { host, status, json } = createHost();

    await filter.catch(
      new PaymentRequiredException('analysis.messages.no_credits', {
        creditsRemaining: 0,
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.PAYMENT_REQUIRED);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 402,
        message: 'translated:analysis.messages.no_credits',
        creditsRemaining: 0,
      }),
    );
  });

  it('does not leak the raw `error` field of Nest exceptions', async () => {
    const { filter } = createFilter();
    const { host, json } = createHost();

    await filter.catch(new NotFoundException('users.errors.not_found'), host);

    const body: Record<string, unknown> | undefined = json.mock.calls[0]?.[0];
    expect(body).toBeDefined();
    expect(Object.keys(body ?? {})).not.toContain('error');
  });

  it('maps an unknown error to a localized 500', async () => {
    const { filter, translate } = createFilter();
    const { host, status, json } = createHost();

    await filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(translate).toHaveBeenCalledWith(
      'common.errors.internal_server_error',
      { lang: 'en' },
    );
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'translated:common.errors.internal_server_error',
      }),
    );
  });

  it('passes a plain message through untouched', async () => {
    const { filter, translate } = createFilter();
    const { host, json } = createHost();

    await filter.catch(new BadRequestException('Boom'), host);

    expect(translate).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Boom' }),
    );
  });

  it('falls back to the raw i18n key when translation fails', async () => {
    const throwing = (key: string): string => {
      throw new Error(`missing translation: ${key}`);
    };
    const { filter } = createFilter(throwing);
    const { host, json } = createHost();

    await filter.catch(
      new BadRequestException('analysis.messages.cv_required'),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'analysis.messages.cv_required' }),
    );
  });

  it('passes an array of validation messages through as-is', async () => {
    const { filter, translate } = createFilter();
    const { host, json } = createHost();

    await filter.catch(
      new BadRequestException({
        statusCode: 400,
        message: ['validation.email', 'validation.minLength'],
      }),
      host,
    );

    expect(translate).not.toHaveBeenCalled();
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: ['validation.email', 'validation.minLength'],
      }),
    );
  });
});
