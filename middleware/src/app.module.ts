import { Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { MetricsService } from './services/metrics.service';
import { MetricsController } from './controllers/metrics.controller';
import { CorrelationInterceptor } from './middlewares/correlation.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { APP_GUARD } from '@nestjs/core';

import configuration from './config/configuration';
import { HttpPaymentClient } from './clients/payment.client';
import { HealthController } from './controllers/health.controller';
import { OrderController } from './controllers/order.controller';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { ORDERS_EVENTS_EXCHANGE } from './messaging/order-event';
import { RabbitMqPublisher } from './messaging/publisher.service';
import { OrderService, PAYMENT_CLIENT, PUBLISHER } from './services/order.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
        LoggerModule.forRoot({
            pinoHttp: {
                level: process.env.LOG_LEVEL ?? 'info',
                genReqId: (req) =>
                    req.headers['x-correlation-id']?.toString() ?? crypto.randomUUID(),
                customProps: () => ({ service: 'middleware' }),
                transport: process.env.NODE_ENV !== 'production'
                    ? { target: 'pino-pretty' }
                    : undefined,
            },
        RabbitMQModule.forRoot({
            exchanges: [
                {
                    name: ORDERS_EVENTS_EXCHANGE,
                    type: 'topic',
                    options: { durable: true },
                },
            ],
            uri: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672/',
            connectionInitOptions: { wait: false },
        }),
    ],
    controllers: [HealthController, OrderController,MetricsController],
    providers: [
        OrderService,
        MetricsService,
        { 
            provide: PAYMENT_CLIENT, 
            useClass: HttpPaymentClient 
        },
        {
            provide: APP_INTERCEPTOR,
            useClass: CorrelationInterceptor,
        }
        {
            provide: PAYMENT_CLIENT,
            useClass: HttpPaymentClient,
        },
        {
            provide: PUBLISHER,
            useClass: RabbitMqPublisher,
        },
        JwtStrategy,
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
        {
            provide: APP_GUARD,
            useClass: RolesGuard,
        },
    ],
})
export class AppModule {}