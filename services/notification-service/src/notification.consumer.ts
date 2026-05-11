import { Injectable } from '@nestjs/common';
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { PinoLogger } from 'nestjs-pino';

import {
    ORDER_FAILED_ROUTING_KEY,
    ORDER_PAID_ROUTING_KEY,
    ORDERS_EVENTS_EXCHANGE,
    OrderEvent,
} from './order-event';

@Injectable()
export class NotificationConsumer {
    constructor(private readonly logger: PinoLogger) {
        this.logger.setContext(NotificationConsumer.name);
    }

    @RabbitSubscribe({
        exchange: ORDERS_EVENTS_EXCHANGE,
        routingKey: [ORDER_PAID_ROUTING_KEY, ORDER_FAILED_ROUTING_KEY],
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
