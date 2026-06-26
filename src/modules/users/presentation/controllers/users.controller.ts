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
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
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
  AssignUserShopDto,
  ChangeUserRoleDto,
  CreateShopUserDto,
  DeactivateUserDto,
} from '../../application/dto/user-management.dto';
import {
  AssignUserShopResponseDto,
  ChangeUserRoleResponseDto,
  CreateShopUserResponseDto,
  DeactivateUserResponseDto,
  ShopUserListItemDto,
  UserAssignmentResponseDto,
} from '../../application/dto/user-response.dto';
import {
  AssignUserShopUseCase,
  GetUserAssignmentUseCase,
} from '../../application/use-cases/user-assignment.use-cases';
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
@ApiSecurity('bearer')
export class UsersController {
  constructor(
    private readonly listUsers: ListShopUsersUseCase,
    private readonly createUser: CreateShopUserUseCase,
    private readonly changeRole: ChangeUserRoleUseCase,
    private readonly deactivateUser: DeactivateShopUserUseCase,
    private readonly getAssignment: GetUserAssignmentUseCase,
    private readonly assignShop: AssignUserShopUseCase,
  ) {}

  @Get()
  @RequirePermissions(Permission.USERS_READ)
  @ApiOperation({
    summary: 'Lister les utilisateurs de la boutique',
    description: [
      '**Permission** : `users:read`',
      '',
      'Retourne tous les utilisateurs de la boutique active avec leur rôle, statut et permissions effectives.',
      'Réservé au patron pour la gestion d\'équipe.',
    ].join('\n'),
  })
  @ApiOkResponse({ type: [ShopUserListItemDto], description: 'Liste des utilisateurs' })
  @ApiUnauthorizedResponse({ description: 'Session invalide ou expirée' })
  @ApiForbiddenResponse({ description: 'Permission `users:read` requise' })
  list(@CurrentAuth() auth: AuthContext) {
    return this.listUsers.execute(auth);
  }

  @Get(':id/assignment')
  @RequirePermissions(Permission.USERS_READ)
  @ApiOperation({
    summary: 'Consulter l\'affectation complète d\'un utilisateur',
    description: [
      '**Permission** : `users:read`',
      '',
      'Retourne la boutique d\'affectation, le rôle, les permissions effectives et les overrides individuels.',
      'Le patron peut consulter un utilisateur de n\'importe quelle boutique possédée.',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', example: 2 })
  @ApiOkResponse({ type: UserAssignmentResponseDto })
  @ApiNotFoundResponse({ description: 'Utilisateur introuvable' })
  assignment(@CurrentAuth() auth: AuthContext, @Param('id', ParseIntPipe) id: number) {
    return this.getAssignment.execute(auth, id);
  }

  @Post()
  @RequirePermissions(Permission.USERS_CREATE)
  @ApiOperation({
    summary: 'Créer un vendeur ou lecteur',
    description: [
      '**Permission** : `users:create`',
      '',
      'Crée un compte avec PIN hashé (bcrypt). Seuls les rôles `seller` et `viewer` sont autorisés.',
      'La promotion en patron (`owner`) n\'est pas possible via cette route.',
    ].join('\n'),
  })
  @ApiCreatedResponse({ type: CreateShopUserResponseDto })
  @ApiBadRequestResponse({ description: 'PIN invalide ou nom trop court' })
  @ApiConflictResponse({ description: 'Un utilisateur avec ce nom existe déjà' })
  @ApiForbiddenResponse({ description: 'Permission `users:create` requise' })
  create(@CurrentAuth() auth: AuthContext, @Body() dto: CreateShopUserDto) {
    return this.createUser.execute(auth, dto);
  }

  @Patch(':id/role')
  @RequirePermissions(Permission.USERS_UPDATE_ROLE)
  @ApiOperation({
    summary: 'Modifier le rôle d\'un utilisateur',
    description: [
      '**Permission** : `users:update_role`',
      '',
      'Politiques appliquées :',
      '- Impossible de rétrograder le dernier patron (RG-RBAC)',
      '- Impossible de se rétrograder soi-même',
      '- Promotion en `owner` refusée via cette API',
      '',
      'Une entrée d\'audit `user_role_changed` est créée.',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', example: 2, description: 'ID de l\'utilisateur cible' })
  @ApiOkResponse({ type: ChangeUserRoleResponseDto })
  @ApiNotFoundResponse({ description: 'Utilisateur introuvable dans cette boutique' })
  @ApiForbiddenResponse({ description: 'Politique RBAC ou permission insuffisante' })
  changeUserRole(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeUserRoleDto,
  ) {
    return this.changeRole.execute(auth, id, dto.role, dto.reason);
  }

  @Patch(':id/shop')
  @RequirePermissions(Permission.USERS_ASSIGN_SHOP)
  @ApiOperation({
    summary: 'Réaffecter un utilisateur à une autre boutique',
    description: [
      '**Permission** : `users:assign_shop`',
      '',
      'Transfère un vendeur ou lecteur vers une boutique possédée par le patron.',
      '- Impossible pour les patrons',
      '- Impossible de modifier sa propre affectation',
      '- Vérifie l\'unicité du nom dans la boutique cible',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', example: 2 })
  @ApiOkResponse({ type: AssignUserShopResponseDto })
  @ApiNotFoundResponse({ description: 'Utilisateur ou boutique introuvable' })
  @ApiConflictResponse({ description: 'Nom déjà utilisé dans la boutique cible' })
  @ApiForbiddenResponse({ description: 'Patron ou auto-réaffectation refusée' })
  assignUserShop(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignUserShopDto,
  ) {
    return this.assignShop.execute(auth, id, dto.shopId, dto.reason);
  }

  @Patch(':id/deactivate')
  @RequirePermissions(Permission.USERS_DEACTIVATE)
  @ApiOperation({
    summary: 'Désactiver un utilisateur',
    description: [
      '**Permission** : `users:deactivate`',
      '',
      'Désactive le compte (`is_active = false`). L\'utilisateur ne pourra plus se connecter.',
      '- Impossible de désactiver son propre compte',
      '- Impossible de désactiver le dernier patron actif',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', example: 2 })
  @ApiOkResponse({ type: DeactivateUserResponseDto })
  @ApiNotFoundResponse({ description: 'Utilisateur introuvable' })
  @ApiForbiddenResponse({ description: 'Dernier patron ou auto-désactivation' })
  deactivate(
    @CurrentAuth() auth: AuthContext,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeactivateUserDto,
  ) {
    return this.deactivateUser.execute(auth, id, dto.reason);
  }
}
