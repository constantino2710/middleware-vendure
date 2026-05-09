import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

import { Publisher } from '../services/order.service';

export const ORDERS_EVENTS_EXCHANGE = 'orders.events';

@Injectable()
export class RabbitMqPublisher implements Publisher {
    constructor(private readonly amqp: AmqpConnection) {}

    async publish(routingKey: string, payload: Record<string, unknown>): Promise<void> {
        await this.amqp.publish(ORDERS_EVENTS_EXCHANGE, routingKey, payload);
    }
}
