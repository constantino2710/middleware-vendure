import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { MetricsService } from './services/metrics.service';
import { MetricsController } from './controllers/metrics.controller';
import { CorrelationInterceptor } from './middlewares/correlation.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import configuration from './config/configuration';
import { HealthController } from './controllers/health.controller';
import { OrderController } from './controllers/order.controller';
import { OrderService } from './services/order.service';
import { HttpPaymentClient } from './clients/payment.client';
import { PAYMENT_CLIENT } from './services/order.service';

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
    ],
})
export class AppModule {}