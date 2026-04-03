import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check if application process is alive' })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  health() {
    return this.healthService.getHealth();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Check if application dependencies are ready' })
  @ApiResponse({ status: 200, description: 'Service is ready to receive traffic' })
  @ApiResponse({ status: 503, description: 'Service dependencies are not ready' })
  async ready() {
    const readiness = await this.healthService.getReadiness();

    if (readiness.status !== 'ready') {
      throw new ServiceUnavailableException({
        code: 'SERVICE_NOT_READY',
        message: 'Service is not ready',
        checks: readiness.checks,
      });
    }

    return readiness;
  }
}
