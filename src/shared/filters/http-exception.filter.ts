import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorCode } from '../enums/error-code.enum';
import { DomainException } from '../exceptions/domain.exception';

interface NormalizedError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  hint?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const normalized = this.normalize(exception, status);

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json({
      success: false,
      error: normalized,
      timestamp: Date.now(),
    });
  }

  private normalize(exception: unknown, status: number): NormalizedError {
    if (exception instanceof DomainException) {
      return exception.toPayload();
    }

    if (exception instanceof HttpException) {
      const body = exception.getResponse();

      if (typeof body === 'object' && body !== null) {
        const record = body as Record<string, unknown>;

        if (typeof record.code === 'string' && typeof record.message === 'string') {
          return {
            code: record.code as ErrorCode,
            message: record.message,
            details: record.details as Record<string, unknown> | undefined,
            hint: record.hint as string | undefined,
          };
        }

        if (Array.isArray(record.message)) {
          return {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Données invalides.',
            details: { errors: record.message },
          };
        }

        if (typeof record.message === 'string') {
          return {
            code: this.statusToCode(status),
            message: record.message,
            details: this.extractNestDetails(record),
          };
        }
      }

      if (typeof body === 'string') {
        return { code: this.statusToCode(status), message: body };
      }
    }

    return {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'Une erreur interne est survenue.',
    };
  }

  private statusToCode(status: number): ErrorCode {
    switch (status) {
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }

  private extractNestDetails(record: Record<string, unknown>): Record<string, unknown> | undefined {
    const { message: _msg, statusCode: _status, error: _err, ...rest } = record;
    return Object.keys(rest).length > 0 ? rest : undefined;
  }
}
