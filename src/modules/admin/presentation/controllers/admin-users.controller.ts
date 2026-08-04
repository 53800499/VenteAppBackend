import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { AdminGuard } from '../../../../shared/guards/admin.guard';
import type { AdminAuthContext } from '../../../../shared/guards/admin.guard';
import { CurrentAdmin } from '../../../../shared/decorators/current-admin.decorator';
import { RequireAdminRoles } from '../../../../shared/decorators/admin-roles.decorator';
import { AdminRole } from '../../../../shared/enums/admin-role.enum';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import { AdminUserService } from '../../domain/services/admin-user.service';

export class CreateAdminUserDto {
  @ApiProperty({ example: 'support@arike.app', description: 'Adresse email de l\'administrateur' })
  @IsEmail({}, { message: 'Format d\'email invalide.' })
  @IsNotEmpty({ message: 'L\'email est obligatoire.' })
  email!: string;

  @ApiProperty({ example: 'MotDePasseSecret2026!', description: 'Mot de passe (8 caractères min)' })
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  password!: string;

  @ApiProperty({ example: 'Jean Dupont', description: 'Nom complet de l\'administrateur' })
  @IsString()
  @IsNotEmpty({ message: 'Le nom complet est obligatoire.' })
  fullName!: string;

  @ApiProperty({ enum: AdminRole, example: AdminRole.SUPPORT_ADMIN, description: 'Rôle d\'administration' })
  @IsEnum(AdminRole, { message: 'Rôle d\'administration invalide.' })
  role!: AdminRole;
}

export class UpdateAdminUserDto {
  @ApiPropertyOptional({ example: 'Jean Marc Dupont' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ enum: AdminRole, example: AdminRole.BILLING_ADMIN })
  @IsOptional()
  @IsEnum(AdminRole)
  role?: AdminRole;

  @ApiPropertyOptional({ example: 'NouveauMotDePasse2026!' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  isActive?: boolean;
}

@ApiTags('Admin - Gestion des Administrateurs')
@Controller('admin/users')
@UseGuards(AdminGuard)
@ApiBearerAuth()
@UseInterceptors(TransformResponseInterceptor)
export class AdminUsersController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_ADMIN, AdminRole.BILLING_ADMIN, AdminRole.READ_ONLY_ADMIN)
  @ApiOperation({ summary: 'Lister les administrateurs de la plateforme' })
  async listAdmins() {
    return this.adminUserService.listAdmins();
  }

  @Get(':id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN, AdminRole.SUPPORT_ADMIN)
  @ApiOperation({ summary: 'Détail d\'un utilisateur administrateur' })
  async getAdminDetail(@Param('id') id: string) {
    return this.adminUserService.getAdminById(id);
  }

  @Post()
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Créer un nouvel utilisateur administrateur' })
  async createAdmin(
    @CurrentAdmin() admin: AdminAuthContext,
    @Body() dto: CreateAdminUserDto,
  ) {
    const created = await this.adminUserService.createAdmin({
      email: dto.email,
      password: dto.password,
      fullName: dto.fullName,
      role: dto.role,
    });

    return {
      message: 'Compte administrateur créé avec succès.',
      createdBy: admin.email,
      admin: created,
    };
  }

  @Patch(':id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Modifier les rôles, infos ou statut d\'un administrateur' })
  async updateAdmin(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    const updated = await this.adminUserService.updateAdmin(id, {
      fullName: dto.fullName,
      role: dto.role,
      password: dto.password,
      isActive: dto.isActive,
    });

    return {
      message: 'Compte administrateur mis à jour avec succès.',
      updatedBy: admin.email,
      admin: updated,
    };
  }

  @Delete(':id')
  @RequireAdminRoles(AdminRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Supprimer ou désactiver un administrateur' })
  async deleteAdmin(
    @CurrentAdmin() admin: AdminAuthContext,
    @Param('id') id: string,
  ) {
    await this.adminUserService.deleteAdmin(id);
    return {
      message: 'Administrateur supprimé avec succès.',
      deletedBy: admin.email,
      adminId: id,
    };
  }
}
