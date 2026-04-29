// Pessoa 4 — Observabilidade (Correlation ID Interceptor)
//
// @Injectable()
// export class CorrelationInterceptor implements NestInterceptor {
//   intercept(ctx: ExecutionContext, next: CallHandler) {
//     const req = ctx.switchToHttp().getRequest();
//     const res = ctx.switchToHttp().getResponse();
//     const id = req.headers['x-correlation-id'] ?? randomUUID();
//     req.correlationId = id;
//     res.setHeader('X-Correlation-ID', id);
//     return next.handle();
//   }
// }
//
// Registrar globalmente no AppModule:
//   { provide: APP_INTERCEPTOR, useClass: CorrelationInterceptor }
//
// O correlationId é repassado para:
//   - logger pino (mixin/child logger)
//   - PaymentClient (header X-Correlation-ID)
//   - PublisherService (campo correlation_id no payload)
