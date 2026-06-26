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
}
