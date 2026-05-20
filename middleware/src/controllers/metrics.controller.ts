import { Controller, Get, Header } from '@nestjs/common';
import { register } from 'prom-client';

import { Public } from '../auth/decorators/public.decorator';

@Controller('metrics')
export class MetricsController {
  @Public()
  @Get()
  @Header('Content-Type', register.contentType)
  getMetrics() {
    return register.metrics();
  }
}
