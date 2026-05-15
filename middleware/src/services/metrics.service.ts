import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  
  public readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total de requisições HTTP recebidas',
    labelNames: ['route', 'status'],
  });

  public readonly paymentOutcomes = new Counter({
    name: 'payment_outcomes_total',
    help: 'Resultado das tentativas de pagamento',
    labelNames: ['status'], 
  });

  public readonly httpRequestDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duração das requisições',
    labelNames: ['route'],
    buckets: [0.1, 0.3, 0.5, 1, 2, 5], 
  });
}