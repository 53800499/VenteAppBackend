import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T = unknown> {
  @ApiProperty({ example: true, description: 'Indique si la requête a réussi' })
  success: boolean;

  @ApiProperty({ description: 'Données métier de la réponse' })
  data: T;

  @ApiProperty({
    example: 1719225600000,
    description: 'Horodatage Unix en millisecondes',
  })
  timestamp: number;
}
