// Pessoa 3 — Consumer da fila orders.events.
//
// @Injectable()
// export class NotificationConsumer {
//   constructor(private readonly logger: PinoLogger) {}
//
//   @RabbitSubscribe({
//     exchange: 'orders.events',
//     routingKey: ['order.paid', 'order.failed'],
//     queue: 'notification.events',
//   })
//   async handle(msg: { orderId: string; status: 'PAID' | 'FAILED'; timestamp: string; correlation_id: string }) {
//     this.logger.info({
//       correlation_id: msg.correlation_id,
//       service: 'notification',
//       event: 'order_event_received',
//       status: msg.status,
//       orderId: msg.orderId,
//     });
//     // (real) → enviar e-mail / push / SMS
//   }
// }
//
// Bônus:
//   - rastrear messageId já processado (idempotência)
//   - DLX + retry
