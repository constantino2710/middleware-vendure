import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'pino-nestjs';

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
        LoggerModule.forRoot()
    ],

    controllers: [HealthController, OrderController],
    providers: [
    OrderService,
    { 
      provide: PAYMENT_CLIENT, 
      useClass: HttpPaymentClient 
    }
  ],
})
export class AppModule {}
