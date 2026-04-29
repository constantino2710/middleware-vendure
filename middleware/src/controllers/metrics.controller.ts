// Pessoa 4 — Observabilidade
//
// @Controller('metrics')
// export class MetricsController {
//   @Get()
//   async metrics(@Res() res: Response) {
//     // opção simples: contadores in-memory + JSON
//     // opção idiomática: prom-client (registry.metrics()) + content-type text/plain
//   }
// }
//
// Métricas mínimas (seção 11 contexto-geral):
//   - requests
//   - errors
//   - avg_latency_ms
