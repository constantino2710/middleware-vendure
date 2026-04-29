// Bootstrap notification-service.
//
// Não expõe HTTP (worker puro), mas inicializamos via Nest pra reaproveitar DI:
//
// import { NestFactory } from '@nestjs/core';
// import { AppModule } from './app.module';
// import { Logger } from 'nestjs-pino';
//
// async function bootstrap() {
//   const app = await NestFactory.createApplicationContext(AppModule);
//   app.useLogger(app.get(Logger));
// }
// bootstrap();
