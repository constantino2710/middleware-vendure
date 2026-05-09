import { Injectable } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { PinoLogger } from 'nestjs-pino';

export const ORDERS_EVENTS_EXCHANGE = 'orders.events';

type OrderEventStatus = 'PAID' | 'FAILED';

interface OrderEvent {
    orderId: string;
    status: OrderEventStatus;
    timestamp: string;
    correlation_id: string;
}

@Injectable()
export class NotificationConsumer {
    constructor(private readonly logger: PinoLogger) {
        this.logger.setContext(NotificationConsumer.name);
    }

    @RabbitSubscribe({
        exchange: ORDERS_EVENTS_EXCHANGE,
        routingKey: ['order.paid', 'order.failed'],
        queue: 'notifications',
        queueOptions: { durable: true },
    })
    async handleOrderEvent(message: OrderEvent): Promise<void> {
        this.logger.info({
            correlation_id: message.correlation_id,
            service: 'notification-service',
            event: 'order_event_received',
            orderId: message.orderId,
            status: message.status,
            timestamp: message.timestamp,
        });
    }
}
