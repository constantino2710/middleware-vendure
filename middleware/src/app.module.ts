import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import configuration from './config/configuration';
import { HealthController } from './controllers/health.controller';
import { OrderController } from './controllers/order.controller';
import { OrderService } from './services/order.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),
    ],
    controllers: [HealthController, OrderController],
    providers: [OrderService],
})
export class AppModule {}
