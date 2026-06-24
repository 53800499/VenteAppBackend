import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorDto {
  @ApiProperty({ example: 401 })
  statusCode: number;

  @ApiProperty({ example: 'Code incorrect. 3 tentatives restantes.' })
  message: string | Record<string, unknown>;

  @ApiProperty({ example: 'Unauthorized' })
  error: string;
}

export class InvalidPinErrorDto extends ApiErrorDto {
  @ApiProperty({ example: 401 })
  declare statusCode: number;

  @ApiProperty({
    example: {
      message: 'Code incorrect. 3 tentatives restantes.',
      remainingAttempts: 3,
    },
  })
  declare message: Record<string, unknown>;
}

export class AccountLockedErrorDto extends ApiErrorDto {
  @ApiProperty({ example: 403 })
  declare statusCode: number;

  @ApiProperty({
    example: {
      message: 'Application verrouillée. Réessayez plus tard.',
      lockedUntil: 1719226500000,
      remainingSeconds: 900,
    },
  })
  declare message: Record<string, unknown>;
}

export class MaxAttemptsLockoutErrorDto extends ApiErrorDto {
  @ApiProperty({ example: 403 })
  declare statusCode: number;

  @ApiProperty({
    example: {
      message: 'Trop de tentatives. Application verrouillée pendant 15 minutes.',
      lockedUntil: 1719226500000,
      remainingSeconds: 900,
      lockoutCount: 1,
      requiresEmergencyRecovery: false,
    },
  })
  declare message: Record<string, unknown>;
}

export class EmergencyRecoveryRequiredErrorDto extends ApiErrorDto {
  @ApiProperty({ example: 403 })
  declare statusCode: number;

  @ApiProperty({
    example: {
      message: 'Déblocage impossible par PIN. Utilisez le fichier de récupération d\'urgence.',
      requiresEmergencyRecovery: true,
    },
  })
  declare message: Record<string, unknown>;
}

export class ValidationErrorDto {
  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({
    example: ['Le PIN doit comporter entre 4 et 6 chiffres numériques.'],
    type: [String],
  })
  message: string[];

  @ApiProperty({ example: 'Bad Request' })
  error: string;
}

export class ConflictErrorDto extends ApiErrorDto {
  @ApiProperty({ example: 409 })
  declare statusCode: number;

  @ApiProperty({ example: "L'installation a déjà été effectuée." })
  declare message: string;
}

export class NotFoundErrorDto extends ApiErrorDto {
  @ApiProperty({ example: 404 })
  declare statusCode: number;

  @ApiProperty({ example: 'Boutique 1 introuvable.' })
  declare message: string;
}
