import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums/error-code.enum';

export interface DomainErrorPayload {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  hint?: string;
}

export class DomainException extends HttpException {
  readonly code: ErrorCode;
  readonly errorMessage: string;
  readonly details?: Record<string, unknown>;
  readonly hint?: string;

  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus,
    details?: Record<string, unknown>,
    hint?: string,
  ) {
    super({ code, message, details, hint }, status);
    this.code = code;
    this.errorMessage = message;
    this.details = details;
    this.hint = hint;
  }

  toPayload(): DomainErrorPayload {
    return {
      code: this.code,
      message: this.errorMessage,
      details: this.details,
      hint: this.hint,
    };
  }
}
