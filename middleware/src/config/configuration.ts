// Configuração centralizada — Pessoa 1 / Pessoa 6.
//
// export default () => ({
//   httpPort: parseInt(process.env.HTTP_PORT ?? '8080', 10),
//   paymentServiceUrl: process.env.PAYMENT_SERVICE_URL!,
//   rabbitmqUrl: process.env.RABBITMQ_URL!,
//   jwtSecret: process.env.JWT_SECRET!,
//   logLevel: process.env.LOG_LEVEL ?? 'info',
// });
//
// Registrar no AppModule via:
//   ConfigModule.forRoot({ isGlobal: true, load: [configuration] })
