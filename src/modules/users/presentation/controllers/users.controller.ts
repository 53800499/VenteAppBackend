import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentAuth } from '../../../../shared/decorators/current-auth.decorator';
import { RequirePermissions } from '../../../../shared/decorators/permissions.decorator';
import { Permission } from '../../../../shared/enums/permission.enum';
import { PermissionsGuard } from '../../../../shared/guards/permissions.guard';
import { SessionGuard } from '../../../../shared/guards/session.guard';
import { TenantGuard } from '../../../tenants/tenant.guard';
import type { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { TransformResponseInterceptor } from '../../../../shared/interceptors/transform-response.interceptor';
import {
  ChangeUserRoleDto,
  CreateShopUserDto,
} from '../../application/dto/user-management.dto';
import {
  ChangeUserRoleUseCase,
  CreateShopUserUseCase,
  DeactivateShopUserUseCase,
  ListShopUsersUseCase,
} from '../../application/use-cases/user-management.use-cases';

@ApiTags('Utilisateurs')
@Controller('users')
@UseInterceptors(TransformResponseInterceptor)
@UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
@ApiSecurity('session-token')
export class UsersController {
  constructor(
    private readonly listUsers: ListShopUsersUseCase,
    private readonly createUser: CreateShopUserUseCase,
    private readonly changeRole: ChangeUserRoleUseCase,
    private readonly deactivateUser: DeactivateShopUserUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.USERS_READ)
  @ApiOperation({ summary: 'Lister les utilisateurs de la boutique' })
  @ApiOkResponse({ description: 'Liste des utilisateurs avec rôles et permissions' })
  @ApiUnauthorizedResponse()
  @ApiForbiddenResponse()
  list(@CurrentAuth() auth: AuthContext) {
    return this.listUsers.execute(auth);
  }

  @Post()
  @RequirePermissions(Permission.USERS_CREATE)
  @ApiOperation({ summary: 'Créer un vendeur ou lecteur' })
  @ApiCreatedResponse({ description: 'Utilisateur créé' })
  create(@CurrentAuth() auth: AuthContext, @Body() dto: CreateShopUserDto) {
    return this.createUser.execute(auth, dto);
  }

  @Patch(':id/role')
  @RequirePermissions(Permission.USERS_UPDATE_ROLE)
  @ApiOperation({ summary: 'Modifier le rôle d\'un utilisateur (audit tracé)' })
  changeUserRole(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeUserRoleDto,
  ) {
    return this.changeRole.execute(auth, id, dto.role, dto.reason);
  }

  @Patch(':id/deactivate')
  @RequirePermissions(Permission.USERS_DEACTIVATE)
  @ApiOperation({ summary: 'Désactiver un utilisateur' })
  deactivate(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason?: string,
  ) {
    return this.deactivateUser.execute(auth, id, reason);
  }
}
