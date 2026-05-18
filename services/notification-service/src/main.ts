import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.createApplicationContext(AppModule, {
        bufferLogs: true,
    });

    app.useLogger(app.get(Logger));
}

void bootstrap();
