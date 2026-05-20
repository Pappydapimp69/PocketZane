import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  get(): { status: 'ok'; service: 'signal-api' } {
    return { status: 'ok', service: 'signal-api' };
  }
}
