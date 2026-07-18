import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiResponseDto } from '../../../../shared/dto/api-response.dto';

export class AccessibleShopDto {
  @ApiProperty({ example: 2 })
  id: number;

  @ApiProperty({ example: 'Porto' })
  name: string;

  @ApiProperty({ example: true })
  isCurrent: boolean;

  @ApiProperty({ example: false })
  isDefault: boolean;

  @ApiPropertyOptional({ example: 'viewer', nullable: true })
  accessRole?: string | null;

  @ApiProperty({ example: 'Lecteur' })
  roleLabel: string;
}

export class IdentityContextDto {
  @ApiProperty({ example: 1 })
  membershipId: number;

  @ApiPropertyOptional({ example: 3, nullable: true })
  identityId?: number | null;

  @ApiProperty({ example: 1 })
  organizationId: number;

  @ApiProperty({ example: 'SOGEMAT' })
  organizationName: string;

  @ApiProperty({ example: 'owner' })
  role: string;

  @ApiProperty({ example: 'Patron' })
  roleLabel: string;

  @ApiProperty({ example: 'owner' })
  effectiveRole: string;

  @ApiProperty({ example: 'Patron' })
  effectiveRoleLabel: string;

  @ApiProperty({ example: 3 })
  activeShopId: number;

  @ApiProperty({ example: 'Parakou' })
  activeShopName: string;

  @ApiProperty({ type: [AccessibleShopDto] })
  accessibleShops: AccessibleShopDto[];
}

export class IdentityContextResponseDto extends ApiResponseDto<IdentityContextDto> {
  @ApiProperty({ type: IdentityContextDto })
  declare data: IdentityContextDto;
}
