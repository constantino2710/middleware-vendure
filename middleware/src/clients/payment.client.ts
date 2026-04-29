// Pessoa 2 — Resiliência + HTTP Client
//
// @Injectable()
// export class PaymentClient {
//   private readonly baseUrl = process.env.PAYMENT_SERVICE_URL!;
//
//   async pay(orderId: string, amount: number): Promise<{ status: 'approved' | 'declined' | 'pending' }> {
//     // Usar p-retry para 3 tentativas com backoff 1s → 2s → 4s
//     // Usar axios com timeout: 2_000
//     // Em caso de erro persistente: retornar { status: 'pending' } (fallback)
//   }
// }
//
// Requisitos (seção 10 contexto-geral):
//   - Retry: 3 tentativas
//   - Backoff: 1s → 2s → 4s
//   - Timeout: 2s
//   - Fallback: PENDING
//   - (opcional) opossum para circuit breaker
