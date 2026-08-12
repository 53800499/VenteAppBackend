import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums/error-code.enum';

export type ErrorSuggestedAction = 'RETRY' | 'EDIT_OPERATION' | 'DISCARD';

export interface DomainErrorPayload {
  code: ErrorCode;
  message: string;
  retryable?: boolean;
  action?: ErrorSuggestedAction;
  details?: Record<string, unknown>;
  hint?: string;
}

export class DomainException extends HttpException {
  readonly code: ErrorCode;
  readonly errorMessage: string;
  readonly retryable?: boolean;
  readonly action?: ErrorSuggestedAction;
  readonly details?: Record<string, unknown>;
  readonly hint?: string;

  constructor(
    code: ErrorCode,
    message: string,
    status: HttpStatus,
    details?: Record<string, unknown>,
    hint?: string,
    retryable?: boolean,
    action?: ErrorSuggestedAction,
  ) {
    super({ code, message, details, hint, retryable, action }, status);
    this.code = code;
    this.errorMessage = message;
    this.details = details;
    this.hint = hint;
    this.retryable = retryable;
    this.action = action;
  }

  toPayload(): DomainErrorPayload {
    return {
      code: this.code,
      message: this.errorMessage,
      retryable: this.retryable,
      action: this.action,
      details: this.details,
      hint: this.hint,
    };
  }
}
