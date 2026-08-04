import { Body, Controller, Get, Post, UnauthorizedException, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import { AdminGuard } from '../../../../shared/guards/admin.guard';
import type { AdminAuthContext } from '../../../../shared/guards/admin.guard';
import { CurrentAdmin } from '../../../../shared/decorators/current-admin.decorator';
import { AdminRole } from '../../../../shared/enums/admin-role.enum';
import { AdminUserService } from '../../domain/services/admin-user.service';

export class AdminLoginDto {
  @ApiProperty({ example: 'admin@arike.app', description: 'Email administrateur' })
  @IsEmail({}, { message: 'Format d\'email invalide.' })
  @IsNotEmpty({ message: 'L\'email est obligatoire.' })
  email!: string;

  @ApiProperty({ example: '12345678', description: 'Mot de passe' })
  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères.' })
  @IsNotEmpty({ message: 'Le mot de passe est obligatoire.' })
  password!: string;

  @IsOptional()
  rememberMe?: boolean;
}

@ApiTags('Admin - Authentification')
@Controller('admin/auth')
@UseInterceptors(TransformResponseInterceptor)
export class AdminAuthController {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly adminUserService: AdminUserService,
  ) {}

  @Post('login')
  @ApiOperation({ summary: 'Connexion administrateur au back-office ARIKE' })
  async login(@Body() dto: AdminLoginDto) {
    const inputEmail = (dto.email || '').trim().toLowerCase();

    // 1. Essayer d'abord la base de données (Table admin_users)
    const dbAdmin = await this.adminUserService.getAdminByEmailWithPassword(inputEmail);
    if (dbAdmin) {
      if (!dbAdmin.isActive) {
        throw new UnauthorizedException('Ce compte administrateur est désactivé.');
      }

      const isValidPassword = await this.adminUserService.verifyPassword(dto.password, dbAdmin.passwordHash);
      if (!isValidPassword) {
        throw new UnauthorizedException('Identifiants administrateur invalides.');
      }

      const payload = {
        sub: dbAdmin.id,
        email: dbAdmin.email,
        isAdmin: true,
        adminRole: dbAdmin.role as AdminRole,
        type: 'access',
      };

      const token = await this.jwtService.signAsync(payload, {
        expiresIn: 28800, // 8h
        issuer: 'arike-backoffice',
      });

      return {
        accessToken: token,
        tokenType: 'Bearer',
        expiresInSeconds: 28800,
        admin: {
          id: dbAdmin.id,
          email: dbAdmin.email,
          name: dbAdmin.fullName,
          role: dbAdmin.role,
        },
      };
    }
    throw new UnauthorizedException('Identifiants administrateur invalides.');
  }

  @Get('me')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Profil administrateur connecté' })
  getProfile(@CurrentAdmin() admin: AdminAuthContext) {
    return {
      id: admin.adminId,
      email: admin.email,
      role: admin.role,
    };
  }
}
