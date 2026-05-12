import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import configuration from './config/configuration';
import { HealthController } from './controllers/health.controller';
import { OrderController } from './controllers/order.controller';
import { OrderService } from './services/order.service';
import { HttpPaymentClient } from './clients/payment.client';
import { PAYMENT_CLIENT } from './services/order.service';

import { APP_GUARD } from '@nestjs/core';

import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
    ],
    controllers: [HealthController, OrderController],
    providers: [
    OrderService,
    { 
      provide: PAYMENT_CLIENT, 
      useClass: HttpPaymentClient 
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
