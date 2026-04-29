// Módulo raiz — Pessoa 1.
//
// Importa:
//   - ConfigModule.forRoot({ isGlobal: true }) — Pessoa 1
//   - LoggerModule (nestjs-pino) — Pessoa 4
//   - HttpModule / axios — Pessoa 2 (paymentClient)
//   - RabbitMQModule (@golevelup/nestjs-rabbitmq) — Pessoa 3
//   - JwtModule + PassportModule — Pessoa 5
//   - Providers globais:
//        APP_INTERCEPTOR → CorrelationInterceptor (Pessoa 4)
//        APP_GUARD       → JwtAuthGuard, RolesGuard (Pessoa 5)
//
// Controllers:
//   - OrderController        (POST /process-order)
//   - MetricsController      (GET /metrics) — Pessoa 4
//
// Providers:
//   - OrderService
//   - PaymentClient
//   - PublisherService
