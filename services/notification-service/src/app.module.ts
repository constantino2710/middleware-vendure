import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { LoggerModule } from 'nestjs-pino';

import { ORDERS_EVENTS_EXCHANGE } from './order-event';
import { NotificationConsumer } from './notification.consumer';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        LoggerModule.forRoot(),
        RabbitMQModule.forRoot({
            exchanges: [
                {
                    name: ORDERS_EVENTS_EXCHANGE,
                    type: 'topic',
                    options: { durable: true },
                },
            ],
            uri: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672/',
            connectionInitOptions: { wait: true },
        }),
    ],
    providers: [NotificationConsumer],
})
export class AppModule {}
