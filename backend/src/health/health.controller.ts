import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { HealthLiveness, HealthReadiness } from './interface';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check if application process is alive' })
  @ApiResponse({ status: 200, description: 'Application process is alive.' })
  health(): HealthLiveness {
    return this.healthService.getHealth();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Check if application dependencies are ready' })
  @ApiResponse({ status: 200, description: 'Application dependencies are ready.' })
  @ApiResponse({ status: 503, description: 'Application dependencies are not ready.' })
  async ready(): Promise<HealthReadiness> {
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
