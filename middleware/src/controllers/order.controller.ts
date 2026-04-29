// Pessoa 1 — Core Middleware
//
// @Controller('process-order')
// export class OrderController {
//   constructor(private readonly orderService: OrderService) {}
//
//   @Post()
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles('USER', 'ADMIN')
//   async process(
//     @Body() dto: ProcessOrderDto,
//     @Req() req: Request & { correlationId: string },
//   ): Promise<ProcessOrderResponse> {
//     return this.orderService.process(dto, req.correlationId);
//   }
// }
//
// Status codes (seção 6 contexto-geral):
//   200 OK              → status SUCCESS / FAILED / PENDING
//   401 Unauthorized    → JwtAuthGuard rejeitou
//   500 Internal        → erro inesperado
