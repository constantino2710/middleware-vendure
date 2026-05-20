import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { Roles } from '../auth/decorators/roles.decorator';

import { OrderService } from '../services/order.service';
import { ProcessOrderDto, ProcessOrderResponse } from './dto/process-order.dto';

@Controller('process-order')
export class OrderController {
    constructor(private readonly orderService: OrderService) {}

    @Post()
    @Roles('service')
    @HttpCode(HttpStatus.OK)
    async process(
        @Body() dto: ProcessOrderDto,
        @Headers('x-correlation-id') headerCorrelationId?: string,
    ): Promise<ProcessOrderResponse> {
        const correlationId = headerCorrelationId ?? randomUUID();
        return this.orderService.process(dto, correlationId);
    }
}
