import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

@Injectable()
export class I18nResponseInterceptor implements NestInterceptor {
  constructor(private readonly i18n: I18nService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const lang = I18nContext.current()?.lang ?? 'ar';
    return next.handle().pipe(
      mergeMap(async (data) => {
        if (data?.message && typeof data.message === 'string') {
          const translateArgs = data.args || {};
          data.message = await this.i18n.translate(data.message, {
            lang,
            args: translateArgs,
          });
        }
        return data;
      }),
    );
  }
}
