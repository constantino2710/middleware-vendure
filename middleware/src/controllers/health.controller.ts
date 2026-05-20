import { Controller, Get } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
    @Public()
    @Get()
    check(): { status: 'ok'; uptime: number } {
        return { status: 'ok', uptime: process.uptime() };
    }
}
