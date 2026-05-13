import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { APP_CONFIG, AppConfig } from './config/configuration';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {bufferLogs: true });
    app.useLogger(app.get(Logger));
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        }),
    );
    const config = app.get(ConfigService).getOrThrow<AppConfig>(APP_CONFIG);
    await app.listen(config.httpPort);
}

void bootstrap();
