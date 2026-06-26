import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';
import { ApiResponseDto } from '../../../../shared/dto/api-response.dto';

export class RequestWhatsappOtpDto {
  @ApiProperty({ example: '+22990123456', description: 'Numéro WhatsApp du compte' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  phone: string;
}

export class VerifyWhatsappOtpDto {
  @ApiProperty({ example: '+22990123456' })
  @IsString()
  @IsNotEmpty()
  phone: string;

  @ApiProperty({ example: '123456', description: 'Code reçu sur WhatsApp' })
  @IsString()
  @Matches(/^\d{4,8}$/)
  code: string;
}

export class CompleteWhatsappOtpLoginDto {
  @ApiProperty({ description: 'Jeton émis après vérification OTP' })
  @IsString()
  @IsNotEmpty()
  verificationToken: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  shopId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  userId: number;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  deviceId: string;

  @ApiProperty({ example: 'Samsung A14', required: false })
  @IsOptional()
  @IsString()
  deviceLabel?: string;
}

export class ShopMembershipItemDto {
  @ApiProperty({ example: 1 })
  userId: number;

  @ApiProperty({ example: 2 })
  shopId: number;

  @ApiProperty({ example: 'Boutique Akpakpa' })
  shopName: string;

  @ApiProperty({ example: 'seller' })
  role: string;

  @ApiProperty({ example: 'Vendeur' })
  roleLabel: string;

  @ApiProperty({ example: true })
  isDefault: boolean;
}

export class RequestWhatsappOtpDataDto {
  @ApiProperty({ example: '+229 ** ** 56' })
  maskedPhone: string;

  @ApiProperty({ example: 300, description: 'Durée de validité en secondes' })
  expiresInSeconds: number;

  @ApiProperty({ example: 'Code envoyé sur WhatsApp.' })
  message: string;
}

export class VerifyWhatsappOtpDataDto {
  @ApiProperty()
  verificationToken: string;

  @ApiProperty({ type: [ShopMembershipItemDto] })
  memberships: ShopMembershipItemDto[];
}

export class RequestWhatsappOtpResponseDto extends ApiResponseDto<RequestWhatsappOtpDataDto> {
  @ApiProperty({ type: RequestWhatsappOtpDataDto })
  declare data: RequestWhatsappOtpDataDto;
}

export class VerifyWhatsappOtpResponseDto extends ApiResponseDto<VerifyWhatsappOtpDataDto> {
  @ApiProperty({ type: VerifyWhatsappOtpDataDto })
  declare data: VerifyWhatsappOtpDataDto;
}
