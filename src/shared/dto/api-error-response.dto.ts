import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorCode } from '../enums/error-code.enum';

export class ApiErrorDto {
  @ApiProperty({ enum: ErrorCode, example: ErrorCode.RBAC_INSUFFICIENT_PERMISSION })
  code: ErrorCode;

  @ApiProperty({ example: 'Permissions insuffisantes pour cette action.' })
  message: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  details?: Record<string, unknown>;

  @ApiPropertyOptional({ example: 'Contactez le patron de la boutique pour obtenir les droits nécessaires.' })
  hint?: string;
}

export class ApiErrorResponseDto {
  @ApiProperty({ example: false })
  success: false;

  @ApiProperty({ type: ApiErrorDto })
  error: ApiErrorDto;

  @ApiProperty({ example: 1719225600000 })
  timestamp: number;
}
