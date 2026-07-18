import { Body, Controller, Get, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import {
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentAuth } from '../../../../shared/decorators/current-auth.decorator';
import { RequirePermissions } from '../../../../shared/decorators/permissions.decorator';
import { ApiErrorDto } from '../../../../shared/dto/api-error.dto';
import { Permission } from '../../../../shared/enums/permission.enum';
import { PermissionsGuard } from '../../../../shared/guards/permissions.guard';
import { SessionGuard } from '../../../../shared/guards/session.guard';
import type { AuthContext } from '../../../../shared/interfaces/auth-context.interface';
import { TenantGuard } from '../../../tenants/tenant.guard';
import {
  SyncUserShopAccessDto,
  SyncUserShopAccessResponseDto,
} from '../../application/dto/shop-access.dto';
import { UserShopAccessResponseDto } from '../../application/dto/user-shop-access.dto';
import { GetUserShopAccessUseCase } from '../../application/use-cases/get-user-shop-access.use-case';
import { SyncUserShopAccessUseCase } from '../../application/use-cases/sync-user-shop-access.use-case';

@ApiTags('Identité')
@Controller('identity')
export class IdentityController {
  constructor(
    private readonly getUserShopAccess: GetUserShopAccessUseCase,
    private readonly syncUserShopAccess: SyncUserShopAccessUseCase,
  ) {}

  @Get('users/:userId/shop-access')
  @UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions(Permission.USERS_READ)
  @ApiSecurity('bearer')
  @ApiOperation({
    summary: 'Consulter les accès multi-boutiques d\'un utilisateur',
    description:
      'Patron uniquement — retourne le membership et les boutiques autorisées avec rôle effectif.',
  })
  @ApiOkResponse({ type: UserShopAccessResponseDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  getUserShopAccessHandler(
    @CurrentAuth() auth: AuthContext,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.getUserShopAccess.execute(auth, userId);
  }

  @Put('users/:userId/shop-access')
  @UseGuards(SessionGuard, TenantGuard, PermissionsGuard)
  @RequirePermissions(Permission.USERS_ASSIGN_SHOP)
  @ApiSecurity('bearer')
  @ApiOperation({
    summary: 'Définir les accès multi-boutiques d\'un utilisateur',
    description:
      'Patron uniquement — remplace les entrées shop_access avec rôle effectif optionnel par boutique.',
  })
  @ApiOkResponse({ type: SyncUserShopAccessResponseDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  syncUserShopAccessHandler(
    @CurrentAuth() auth: AuthContext,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SyncUserShopAccessDto,
  ) {
    return this.syncUserShopAccess.execute(auth, userId, dto.shops);
  }
}
