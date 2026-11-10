import {
  Controller,
  Get,
  Inject,
  Query,
} from '@nestjs/common';
import { AuthAccess } from '../auth/auth-access.decorator';
import { AnalyticsService } from './analytics.service';
import {
  parseAnalyticsInput,
  analyticsOverviewQuerySchema,
  analyticsSalesQuerySchema,
} from './analytics.schemas';

@Controller('admin/analytics')
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @AuthAccess({
    access: 'admin',
    permission: 'analytics.read',
    scope: 'store',
  })
  overview(@Query() query: Record<string, unknown>) {
    return this.analytics.getOverview(
      parseAnalyticsInput(analyticsOverviewQuerySchema, query),
    );
  }

  @Get('sales')
  @AuthAccess({
    access: 'admin',
    permission: 'analytics.read',
    scope: 'store',
  })
  sales(@Query() query: Record<string, unknown>) {
    return this.analytics.getSales(
      parseAnalyticsInput(analyticsSalesQuerySchema, query),
    );
  }
}
