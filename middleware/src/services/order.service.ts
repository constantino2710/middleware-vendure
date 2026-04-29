// Pessoa 1 — Core Middleware
//
// @Injectable()
// export class OrderService {
//   constructor(
//     private readonly paymentClient: PaymentClient,    // Pessoa 2
//     private readonly publisher: PublisherService,     // Pessoa 3
//     private readonly logger: PinoLogger,              // Pessoa 4
//   ) {}
//
//   async process(dto: ProcessOrderDto, correlationId: string): Promise<ProcessOrderResponse> {
//     // 1. log "payment_attempt" com correlation_id
//     // 2. const result = await this.paymentClient.pay(dto.orderId, dto.total)
//     //    (Pessoa 2 já encapsula retry + timeout + fallback)
//     // 3. if (result.status === 'approved')
//     //      await this.publisher.publish('order.paid',  { orderId, status: 'PAID',   timestamp, correlation_id })
//     //      return { status: 'SUCCESS' }
//     //    else if (declined)
//     //      await this.publisher.publish('order.failed', { orderId, status: 'FAILED', timestamp, correlation_id })
//     //      return { status: 'FAILED' }
//     //    else (fallback)
//     //      return { status: 'PENDING' }
//   }
// }
