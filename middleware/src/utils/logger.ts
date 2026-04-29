// Pessoa 4 — utilitários de log.
//
// Sugestão: configurar nestjs-pino no AppModule:
//
// LoggerModule.forRoot({
//   pinoHttp: {
//     level: process.env.LOG_LEVEL ?? 'info',
//     genReqId: req => req.headers['x-correlation-id'] ?? randomUUID(),
//     customProps: req => ({ correlation_id: req.id, service: 'middleware' }),
//   },
// })
//
// Formato esperado (seção 11 contexto-geral):
//   { correlation_id, service, event, status }
