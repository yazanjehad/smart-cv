import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 402 Payment Required — thrown when a user/session has exhausted
 * its free-trial credits and must upgrade to continue.
 */
export class PaymentRequiredException extends HttpException {
  constructor(
    message: string = 'common.errors.payment_required',
    details: Record<string, unknown> = {},
  ) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        message,
        ...details,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
