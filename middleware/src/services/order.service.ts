import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
    ProcessOrderDto,
    ProcessOrderResponse,
} from '../controllers/dto/process-order.dto';
import { MetricsService } from './metrics.service';
import {
    ORDER_FAILED_ROUTING_KEY,
    ORDER_PAID_ROUTING_KEY,
    OrderEvent,
    OrderEventStatus,
    OrderRoutingKey,
} from '../messaging/order-event';

export type PaymentResultStatus = 'approved' | 'declined' | 'fallback';

export interface PaymentResult {
    status: PaymentResultStatus;
    message?: string;
}

export interface PaymentClient {
    pay(orderId: string, total: number): Promise<PaymentResult>;
}

export interface Publisher {
    publish(routingKey: OrderRoutingKey, payload: OrderEvent): Promise<void>;
}

export const PAYMENT_CLIENT = 'PAYMENT_CLIENT';
export const PUBLISHER = 'PUBLISHER';

@Injectable()
export class OrderService {
    private readonly logger = new Logger(OrderService.name);

    constructor(
        @Optional() @Inject(PAYMENT_CLIENT) private readonly paymentClient?: PaymentClient,
        @Optional() @Inject(PUBLISHER) private readonly publisher?: Publisher,
        @Optional() private readonly metricsService?: MetricsService,
    ) {}

    async process(dto: ProcessOrderDto, correlationId: string): Promise<ProcessOrderResponse> {
        const endTimer = this.metricsService?.httpRequestDuration.startTimer({ route: '/process-order' });
        try {
            this.logger.log(
                `payment_attempt order=${dto.orderId} total=${dto.total} ${dto.currency} cid=${correlationId}`,
            );

            if (!this.paymentClient) {
                this.logger.warn(`PaymentClient not registered — returning PENDING cid=${correlationId}`);
                this.metricsService?.httpRequestsTotal.inc({ route: '/process-order', status: '503' });
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
                this.metricsService?.httpRequestsTotal.inc({ route: '/process-order', status: '500' });
                return { status: 'PENDING', message: `payment unavailable: ${message}` };
            }

            this.metricsService?.httpRequestsTotal.inc({ route: '/process-order', status: '200' });
            this.metricsService?.paymentOutcomes.inc({ status: result.status });
            if (result.status === 'approved') {
                await this.emit(ORDER_PAID_ROUTING_KEY, dto, 'PAID', correlationId);
                return { status: 'SUCCESS', message: 'payment approved' };
            }

            if (result.status === 'declined') {
                await this.emit(ORDER_FAILED_ROUTING_KEY, dto, 'FAILED', correlationId);
                return { status: 'FAILED', message: result.message ?? 'payment declined' };
            }

            return { status: 'PENDING', message: result.message ?? 'payment fallback' };
        } finally {
            if (endTimer) endTimer();
        }
    }

    private async emit(
        routingKey: OrderRoutingKey,
        dto: ProcessOrderDto,
        status: OrderEventStatus,
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