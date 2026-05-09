import { Inject, Injectable, Logger, Optional } from '@nestjs/common';

import {
    ProcessOrderDto,
    ProcessOrderResponse,
} from '../controllers/dto/process-order.dto';

export type PaymentResultStatus = 'approved' | 'declined' | 'fallback';

export interface PaymentResult {
    status: PaymentResultStatus;
    message?: string;
}

export interface PaymentClient {
    pay(orderId: string, total: number): Promise<PaymentResult>;
}

export interface Publisher {
    publish(routingKey: string, payload: Record<string, unknown>): Promise<void>;
}

export const PAYMENT_CLIENT = 'PAYMENT_CLIENT';
export const PUBLISHER = 'PUBLISHER';

@Injectable()
export class OrderService {
    private readonly logger = new Logger(OrderService.name);

    constructor(
        @Optional() @Inject(PAYMENT_CLIENT) private readonly paymentClient?: PaymentClient,
        @Optional() @Inject(PUBLISHER) private readonly publisher?: Publisher,
    ) {}

    async process(dto: ProcessOrderDto, correlationId: string): Promise<ProcessOrderResponse> {
        this.logger.log(
            `payment_attempt order=${dto.orderId} total=${dto.total} ${dto.currency} cid=${correlationId}`,
        );

        if (!this.paymentClient) {
            this.logger.warn(`PaymentClient not registered — returning PENDING cid=${correlationId}`);
            return { status: 'PENDING', message: 'payment client unavailable' };
        }

        let result: PaymentResult;
        try {
            result = await this.paymentClient.pay(dto.orderId, dto.total);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(
                `payment_error order=${dto.orderId} cid=${correlationId} err=${message}`,
            );
            return { status: 'PENDING', message: `payment unavailable: ${message}` };
        }

        if (result.status === 'approved') {
            await this.emit('order.paid', dto, 'PAID', correlationId);
            return { status: 'SUCCESS', message: 'payment approved' };
        }

        if (result.status === 'declined') {
            await this.emit('order.failed', dto, 'FAILED', correlationId);
            return { status: 'FAILED', message: result.message ?? 'payment declined' };
        }

        return { status: 'PENDING', message: result.message ?? 'payment fallback' };
    }

    private async emit(
        routingKey: string,
        dto: ProcessOrderDto,
        status: 'PAID' | 'FAILED',
        correlationId: string,
    ): Promise<void> {
        if (!this.publisher) {
            this.logger.warn(`Publisher not registered — skipping ${routingKey} cid=${correlationId}`);
            return;
        }
        try {
            await this.publisher.publish(routingKey, {
                orderId: dto.orderId,
                status,
                timestamp: new Date().toISOString(),
                correlation_id: correlationId,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.error(
                `publish_error routingKey=${routingKey} order=${dto.orderId} cid=${correlationId} err=${message}`,
            );
        }
    }
}
