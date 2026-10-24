import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { LivenessResponse, ReadinessResponse } from 'shared-types';
import { AuthAccess } from '../../auth/auth-access.decorator';
import { HealthService } from './health.service';

interface StatusResponse {
  status(code: number): void;
}

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  @AuthAccess({ access: 'public' })
  live(): LivenessResponse {
    return { status: 'ok' };
  }

  @Get('ready')
  @AuthAccess({ access: 'public' })
  async ready(@Res({ passthrough: true }) response: StatusResponse): Promise<ReadinessResponse> {
    const result = await this.health.checkReadiness();
    response.status(result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
