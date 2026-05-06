# Middleware Distribuído com Vendure

Trabalho de Arquitetura de Sistemas — middleware distribuído integrado ao Vendure.

Especificação completa: [docs/contexto-geral.md](docs/contexto-geral.md)
Divisão de responsabilidades: [docs/divisão-atividades.md](docs/divisão-atividades.md)

Stack: **TypeScript / NestJS** em todos os serviços, alinhado ao Vendure.

## Arquitetura

```
Vendure → Middleware → Payment Service
                     ↓
                  RabbitMQ
                     ↓
             Notification Service
```

## Estrutura

```
.
├── vendure/                          # Plataforma de e-commerce (fonte de pedidos)
├── middleware/                       # Núcleo NestJS
│   ├── package.json
│   ├── tsconfig.json
│   ├── nest-cli.json
│   ├── Dockerfile
│   └── src/
│       ├── main.ts                   # bootstrap
│       ├── app.module.ts             # módulo raiz (DI, providers globais)
│       ├── controllers/
│       │   ├── order.controller.ts          # Pessoa 1 — POST /process-order
│       │   ├── metrics.controller.ts        # Pessoa 4 — GET /metrics
│       │   └── dto/process-order.dto.ts
│       ├── services/
│       │   └── order.service.ts             # Pessoa 1 — orquestração
│       ├── clients/
│       │   └── payment.client.ts            # Pessoa 2 — retry + timeout + fallback
│       ├── messaging/
│       │   └── publisher.service.ts         # Pessoa 3 — RabbitMQ
│       ├── middlewares/
│       │   ├── jwt-auth.guard.ts            # Pessoa 5 — JWT
│       │   ├── roles.guard.ts               # Pessoa 5 — roles USER/ADMIN
│       │   ├── roles.decorator.ts
│       │   └── correlation.interceptor.ts   # Pessoa 4 — correlation ID
│       ├── config/
│       │   └── configuration.ts
│       └── utils/
│           └── logger.ts
├── services/
│   ├── payment-service/              # NestJS — POST /pay (simulador)
│   └── notification-service/         # NestJS — consumer RabbitMQ
├── docs/
├── docker-compose.yml
└── README.md
```

## Como rodar

```bash
docker compose up -d --build
```

Serviços:
- Vendure Admin: http://localhost:3000/admin (`superadmin` / `superadmin`)
- Middleware: http://localhost:8080
- Payment Service: http://localhost:8081
- RabbitMQ UI: http://localhost:15672 (`guest` / `guest`)
- Postgres: localhost:5432

## Desenvolvimento local (sem Docker) por serviço

```bash
cd middleware
cp .env.example .env
npm install
npm run start:dev
```

Mesmo passo para `services/payment-service` e `services/notification-service`.

## Divisão da equipe

| Pessoa | Área | Pastas principais |
|--------|------|-------------------|
| 1 | Core Middleware | `middleware/src/controllers`, `middleware/src/services` |
| 2 | Resiliência + HTTP | `middleware/src/clients` |
| 3 | Mensageria | `middleware/src/messaging`, `services/notification-service` |
| 4 | Observabilidade | `middleware/src/middlewares/correlation.interceptor.ts`, `metrics.controller.ts` |
| 5 | Segurança | `middleware/src/middlewares/jwt-auth.guard.ts`, `roles.guard.ts` |
| 6 | Integração + Infra | `vendure/`, `docker-compose.yml` |

---

### Contribuição Pessoa 2: Resiliência no Cliente de Pagamentos
O serviço de integração de pagamentos (`HttpPaymentClient`) foi implementado com foco na estabilidade do sistema em rede:
- **Tolerância a Falhas:** Utilização da biblioteca `p-retry` para repetir requisições HTTP que falhem por alguma instabilidade.
- **Backoff Exponencial:** Configuração de 3 tentativas automáticas com espaçamento de tempo crescente, evitando sobrecarregar o serviço externo.
- **Fallback Seguro (Plano B):** Em caso de falha total da rede ou timeout, a aplicação não "quebra" (crash); em vez disso, retorna o estado `pending`.
- **Injeção de Dependências:** O cliente foi desacoplado e injetado no `AppModule` através do token `PAYMENT_CLIENT`.