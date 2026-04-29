// Payment Service — serviço externo simulado.
//
// @Controller('pay')
// export class PaymentController {
//   @Post()
//   pay(@Body() dto: { orderId: string; amount: number }) {
//     // simular: FAILURE_RATE (env) → throw HttpException 500
//     // simular: LATENCY_MS (env)   → await sleep
//     // default: { status: 'approved' }
//   }
// }
//
// DTOs (seção 7 contexto-geral):
//   PaymentRequest:  { orderId: string, amount: number }
//   PaymentResponse: { status: 'approved' | 'declined' }
//
// Variáveis úteis pra demonstração (seção 15):
//   FAILURE_RATE=0.5   → 50% das chamadas retornam 500
//   LATENCY_MS=3000    → força timeout do client (que tem 2s)
