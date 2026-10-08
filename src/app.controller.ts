import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Application')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Vérification de disponibilité',
    description: [
      'Endpoint de santé minimal — confirme que l\'API NestJS répond.',
      '',
      'Préfixe global : `/api`. Documentation interactive : `/api/docs`.',
    ].join('\n'),
  })
  @ApiOkResponse({
    schema: { type: 'string', example: 'Hello World!' },
    description: 'Message de bienvenue',
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({
    summary: 'Sonde de santé API / Internet',
    description: 'Endpoint public léger pour vérifier la joignabilité du serveur ARIKE et l’alignement d’horloge.',
  })
  @ApiOkResponse({
    description: 'Statut du serveur et horodatage UTC',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        serverTime: { type: 'string', example: '2026-10-08T10:30:00.000Z' },
        version: { type: 'string', example: '1.0.0' },
      },
    },
  })
  getHealth(): { status: string; serverTime: string; version: string } {
    return {
      status: 'ok',
      serverTime: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  @Get('sync/health')
  @ApiOperation({
    summary: 'Sonde de synchronisation ARIKE',
    description: 'Vérification de l’infrastructure de synchronisation.',
  })
  getSyncHealth(): { status: string; serverTime: string; syncReady: boolean } {
    return {
      status: 'ok',
      serverTime: new Date().toISOString(),
      syncReady: true,
    };
  }
}
