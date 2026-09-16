import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface LocalizablePayload {
  message: string;
  args?: Record<string, unknown>;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asLocalizable(value: unknown): LocalizablePayload | null {
  if (!isRecord(value)) {
    return null;
  }
  const message = value['message'];
  if (typeof message !== 'string') {
    return null;
  }
  const payload: LocalizablePayload = { ...value, message };
  const args = value['args'];
  if (isRecord(args)) {
    payload.args = args;
  }
  return payload;
}

@Injectable()
export class I18nResponseInterceptor implements NestInterceptor {
  constructor(private readonly i18n: I18nService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<unknown> {
    void context;
    const lang = I18nContext.current()?.lang ?? 'ar';
    return next.handle().pipe(
      map((data: unknown) => {
        const payload = asLocalizable(data);
        if (!payload) {
          return data;
        }
        const translated: string = this.i18n.translate(payload.message, {
          lang,
          ...(payload.args ? { args: payload.args } : {}),
        });
        return { ...payload, message: translated };
      }),
    );
  }
}
