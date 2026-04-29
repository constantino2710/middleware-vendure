// Pessoa 3 — Mensageria (RabbitMQ)
//
// Lib recomendada: @golevelup/nestjs-rabbitmq
//
// @Injectable()
// export class PublisherService {
//   constructor(private readonly amqp: AmqpConnection) {}
//
//   async publish(routingKey: 'order.paid' | 'order.failed', payload: OrderEvent) {
//     await this.amqp.publish('orders.events', routingKey, payload);
//   }
// }
//
// Configuração no AppModule (RabbitMQModule.forRoot):
//   exchanges: [{ name: 'orders.events', type: 'topic', options: { durable: true } }]
//   uri: process.env.RABBITMQ_URL
//
// Payload (seção 8 contexto-geral):
//   { orderId, status: 'PAID' | 'FAILED', timestamp: ISO8601, correlation_id }
//
// Bônus:
//   - mensagem com messageId único (idempotência)
//   - retry via DLX
