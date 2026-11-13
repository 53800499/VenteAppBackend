import { Controller, Get, Post, Body, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { AppUpdatesService } from './app-updates.service';
import { CreateReleaseDto } from './dto/app-update.dto';

@ApiTags('App Updates')
@Controller('app-updates')
export class AppUpdatesController {
  constructor(private readonly updatesService: AppUpdatesService) {}

  @Get(':platform')
  @ApiOperation({ summary: 'Obtenir la dernière version disponible pour une plateforme (ANDROID ou WINDOWS)' })
  @ApiParam({ name: 'platform', enum: ['ANDROID', 'WINDOWS'] })
  @ApiResponse({ status: 200, description: 'Détails de la mise à jour' })
  async getLatest(@Param('platform') platform: string) {
    const release = await this.updatesService.getLatestRelease(platform);
    if (!release) {
      throw new NotFoundException(`Aucune mise à jour trouvée pour la plateforme ${platform}`);
    }
    return release;
  }

  @Get()
  @ApiOperation({ summary: 'Lister toutes les versions publiées' })
  async getAll() {
    return this.updatesService.getAllReleases();
  }

  @Post()
  @ApiOperation({ summary: 'Publier une nouvelle version' })
  async publish(@Body() dto: CreateReleaseDto) {
    return this.updatesService.publishRelease(dto);
  }
}

