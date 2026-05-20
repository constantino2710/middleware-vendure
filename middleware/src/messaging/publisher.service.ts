import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

import { Publisher } from '../services/order.service';
import { OrderEvent, OrderRoutingKey, ORDERS_EVENTS_EXCHANGE } from './order-event';

@Injectable()
export class RabbitMqPublisher implements Publisher {
    constructor(private readonly amqp: AmqpConnection) {}

    async publish(routingKey: OrderRoutingKey, payload: OrderEvent): Promise<void> {
        await this.amqp.publish(ORDERS_EVENTS_EXCHANGE, routingKey, payload);
    }
}
