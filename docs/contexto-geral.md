# 📘 Especificação Técnica — Middleware Distribuído (TypeScript + Vendure)

---

## 0. Status Atual do Projeto

| Componente | Stack | Status | Onde |
| --- | --- | --- | --- |
| **Vendure** (server, worker, dashboard, storefront) | Vendure 3.6.2 + Next.js 16 | 🟢 rodando | `vendure/` |
| **Plugin de bridge Vendure → Middleware** | NestJS dentro do Vendure | 🟢 implementado | [vendure/apps/server/src/plugins/middleware-bridge/middleware-bridge.plugin.ts](../vendure/apps/server/src/plugins/middleware-bridge/middleware-bridge.plugin.ts) |
| **Middleware — Pessoa 1 (core)** | NestJS 10 | 🟢 100% | `middleware/src/` |
| **Middleware — Pessoa 2 (resiliência/HTTP)** | NestJS + axios + p-retry | 🔴 não iniciado | `middleware/src/clients/payment.client.ts` |
| **Middleware — Pessoa 3 (mensageria)** | RabbitMQ + `@golevelup/nestjs-rabbitmq` | 🔴 não iniciado | `middleware/src/messaging/publisher.service.ts` |
| **Middleware — Pessoa 4 (observabilidade)** | Pino + prom-client | 🔴 não iniciado | `middleware/src/middlewares/correlation.interceptor.ts` |
| **Middleware — Pessoa 5 (segurança)** | passport-jwt | 🔴 não iniciado | `middleware/src/middlewares/jwt-auth.guard.ts` |
| **Pessoa 6 — Integração + Infra** | docker-compose | 🟡 parcial (Vendure pronto, faltam serviços) | `docker-compose.yml` |
| **Postgres** | postgres:16-alpine | 🟢 rodando em container | `vendure-postgres` |
| **RabbitMQ** | rabbitmq:3-management-alpine | 🔴 ainda não subido | (definido em compose) |
| **payment-service** (stub NestJS) | NestJS | 🔴 esqueleto | `services/payment-service/` |
| **notification-service** (stub NestJS) | NestJS | 🔴 esqueleto | `services/notification-service/` |

🟢 pronto · 🟡 em andamento · 🔴 a fazer

---

## 1. Visão Geral

Middleware distribuído em **TypeScript (NestJS)** que integra o **Vendure** (e-commerce) com serviços externos.

**Objetivos:**

- Orquestrar processamento de pedidos
- Garantir comunicação síncrona (HTTP) e assíncrona (filas)
- Implementar resiliência (retry + fallback)
- Garantir observabilidade (logs estruturados + métricas)
- Aplicar segurança (JWT + roles)

👉 O Vendure atua como **fonte de eventos**.
👉 O middleware é o **núcleo da arquitetura**.

---

## 2. Stack Tecnológica

### 🔧 Linguagem

- **TypeScript (Node.js 20+)** — OBRIGATÓRIO

### 🧠 Framework Backend

- **NestJS 10** — usado em middleware, payment-service e notification-service

### 🌐 HTTP Client

- `axios` (já instalado em `middleware/`)

### 📨 Mensageria

- **RabbitMQ 3** (image `rabbitmq:3-management-alpine`)
- Lib: `@golevelup/nestjs-rabbitmq` (já instalada)

### 📊 Observabilidade

- **Logs:** `nestjs-pino` (já instalado)
- **Métricas:** `prom-client` (já instalado)

### 🔐 Segurança

- `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt` (já instalados)

### 🧪 Testes

- `jest` + `ts-jest` (já configurados — `npm test` no `middleware/`)

### 🐳 Infra

- Docker + docker-compose 2.x

---

## 3. Arquitetura

```
                  ┌────────────────────┐
                  │  Storefront (3001) │
                  └─────────┬──────────┘
                            │ Shop GraphQL
                            ▼
┌────────────┐    ┌────────────────────┐    ┌─────────────────┐
│ Dashboard  │───▶│ Vendure server     │───▶│ Postgres (5432) │
│  (5173)    │    │ + worker (3000)    │    └─────────────────┘
└────────────┘    └─────────┬──────────┘
                            │ POST /process-order
                            │ X-Correlation-ID: <uuid>
                            │ Authorization: Bearer <jwt>
                            ▼
                  ┌────────────────────┐
                  │  Middleware (8080) │──▶ Payment Service (8081)
                  └─────────┬──────────┘     POST /pay
                            │ publish
                            ▼
                  ┌────────────────────┐
                  │  RabbitMQ (5672)   │
                  │  exchange:         │
                  │  orders.events     │
                  └─────────┬──────────┘
                            │ consume
                            ▼
                  ┌────────────────────┐
                  │ Notification svc   │
                  └────────────────────┘
```

---

## 4. Estrutura Real do Projeto

```
projeto-arq-sistemas/
├── docker-compose.yml         # postgres, rabbitmq, vendure, middleware, payment, notification
├── docs/                      # esta pasta
├── vendure/                   # workspace npm (server, storefront)
│   ├── apps/
│   │   ├── server/            # Vendure backend + plugin de bridge
│   │   └── storefront/        # Next.js 16
│   └── patches/               # patch-package
├── middleware/                # núcleo do projeto
│   └── src/
│       ├── main.ts            # P1
│       ├── app.module.ts      # P1 (com pontos de extensão pra P2..P5)
│       ├── config/            # P1
│       ├── controllers/       # P1
│       ├── services/          # P1 (orquestração)
│       ├── clients/           # P2 (PaymentClient)
│       ├── messaging/         # P3 (Publisher RabbitMQ)
│       └── middlewares/       # P4 (interceptor) e P5 (guards)
└── services/
    ├── payment-service/       # NestJS — POST /pay
    └── notification-service/  # NestJS — consumer RabbitMQ
```

---

## 5. Integração Vendure → Middleware

Implementado em [middleware-bridge.plugin.ts](../vendure/apps/server/src/plugins/middleware-bridge/middleware-bridge.plugin.ts).

**Como funciona:**

1. Plugin registra um listener em `OrderStateTransitionEvent` filtrado por `toState === 'ArrangingPayment'`.
2. Quando dispara, gera um `correlationId` (UUID) e POSTa no middleware.

**Payload enviado:**

```json
{
  "orderId": "4JLW...",
  "customerId": "1",
  "total": 1563.80,
  "currency": "USD"
}
```

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <MIDDLEWARE_JWT>
X-Correlation-ID: <uuid>
```

**Variáveis de ambiente do Vendure:**

```
MIDDLEWARE_URL=http://middleware:8080  # http://localhost:8080 em dev local
MIDDLEWARE_JWT=changeme-dev-token
```

---

## 6. Middleware — API

### `POST /process-order`

**Headers obrigatórios:**

| Header | Notas |
| --- | --- |
| `Content-Type: application/json` | sempre |
| `Authorization: Bearer <JWT>` | exigido após P5 |
| `X-Correlation-ID: <uuid>` | opcional — middleware gera se ausente |

**Request (DTO validado por `class-validator`):**

```ts
export class ProcessOrderDto {
  @IsString() @IsNotEmpty()  orderId!: string;
  @IsString() @IsNotEmpty()  customerId!: string;
  @IsNumber() @IsPositive()  total!: number;
  @IsString() @Length(3,3)   currency!: string;  // ISO 4217
}
```

**Response (HTTP 200):**

```ts
export interface ProcessOrderResponse {
  status: "SUCCESS" | "FAILED" | "PENDING";
  message: string;
}
```

**Códigos de status:**

| Código | Quando |
| --- | --- |
| 200 | Caso normal — body indica SUCCESS / FAILED / PENDING |
| 400 | DTO inválido (validação class-validator) |
| 401 | JWT ausente/inválido (após P5) |
| 500 | Erro inesperado não tratado |

### `GET /health`

Retorna `{ "status": "ok", "uptime": <segundos> }`. Usado pra healthcheck do Docker.

### `GET /metrics` (após P4)

Endpoint Prometheus padrão (`prom-client.register.metrics()`).

---

## 7. Payment Service

### `POST /pay`

**Request:**

```ts
export interface PaymentRequest {
  orderId: string;
  amount: number;
}
```

**Response:**

```ts
export interface PaymentResponse {
  status: "approved" | "declined";
}
```

**Implementação esperada (escopo do payment-service, fora deste documento):** decisão aleatória ou determinística para fins de demo. O que importa é poder simular falha (timeout, 500, indisponibilidade) pra validar a resiliência do middleware.

---

## 8. Comunicação Assíncrona (RabbitMQ)

### Exchange

```
nome:  orders.events
tipo:  topic
```

### Routing keys

- `order.paid` — emitida quando payment retorna `approved`
- `order.failed` — emitida quando payment retorna `declined`

### Payload do evento

```ts
export interface OrderEvent {
  orderId: string;
  status: "PAID" | "FAILED";
  timestamp: string;       // ISO 8601
  correlation_id: string;  // mesmo cid recebido no header
}
```

⚠️ `fallback` (timeout, gateway indisponível) **não emite evento** — o middleware retorna `PENDING` e o caso é resolvido depois (manual ou retry assíncrono).

---

## 9. Fluxo Completo (versão final esperada)

1. Vendure cria pedido e transita pra `ArrangingPayment`.
2. Plugin do Vendure POSTa no middleware com correlation ID.
3. Middleware:
   - Valida JWT (P5).
   - Valida DTO (P1 ✅).
   - Loga `payment_attempt` com correlation ID (P4).
   - Chama Payment Service via HTTP com retry/timeout (P2).
4. Payment responde.
5. Middleware:
   - `approved` → publica `order.paid` (P3) e responde `SUCCESS`.
   - `declined` → publica `order.failed` (P3) e responde `FAILED`.
   - timeout/erro → responde `PENDING` (sem publicar).
6. Notification Service consome `order.paid`/`order.failed` e dispara notificação (log/email).

---

## 10. Resiliência (escopo da Pessoa 2)

| Item | Valor |
| --- | --- |
| Retry | 3 tentativas |
| Backoff | 1s → 2s → 4s |
| Timeout | 2s por requisição |
| Fallback | retornar `{ status: "PENDING" }` |

**Bibliotecas:** `p-retry` (já instalada), `axios` com `timeout: 2000`.
**Opcional:** `opossum` (circuit breaker).

---

## 11. Observabilidade (escopo da Pessoa 4)

### Logs estruturados (Pino)

```json
{
  "correlation_id": "abc-123",
  "service": "middleware",
  "event": "payment_attempt",
  "orderId": "ORD-1",
  "level": "info",
  "time": "2026-05-03T12:00:00.000Z"
}
```

### Correlation ID

- Recebido em `X-Correlation-ID` ou gerado com `uuid` v4.
- Propagado:
  - HTTP downstream (`X-Correlation-ID` no PaymentClient).
  - Mensagens RabbitMQ (campo `correlation_id` no payload).
  - Todos os logs (via `pino-http` + `AsyncLocalStorage` ou interceptor Nest).

### Métricas (Prometheus)

```
GET /metrics
```

Coletar pelo menos:

- `http_requests_total{route, status}` — counter
- `http_request_duration_seconds{route}` — histogram
- `payment_outcomes_total{status}` — counter (SUCCESS/FAILED/PENDING)

---

## 12. Segurança (escopo da Pessoa 5)

### JWT

- Validação via `JwtAuthGuard` (passport-jwt) registrado como `APP_GUARD` global.
- Secret via `JWT_SECRET` no `.env`.
- Token deve conter no mínimo: `sub`, `roles[]`, `iat`, `exp`.

### Roles

- `USER` — pode chamar `POST /process-order`.
- `ADMIN` — acesso total (incluindo `/metrics` se desejado).

### Endpoints públicos

- `GET /health` — sempre público (Docker healthcheck depende disso).
- `GET /metrics` — opcional restringir a `ADMIN`.

---

## 13. Tolerância a Falhas

| Cenário | Resposta esperada |
| --- | --- |
| Payment Service down (sem resposta) | retry → fallback → `PENDING` |
| Payment retorna 500 | retry → fallback → `PENDING` |
| RabbitMQ indisponível na hora de publicar | log de erro + retry posterior; resposta HTTP ainda reflete o pagamento |
| JWT inválido | 401 |
| DTO malformado | 400 |
| Erro não tratado | 500 + log estruturado com correlation_id |

---

## 14. Docker Compose

Definido em `docker-compose.yml` (raiz). Serviços:

| Service | Porta host | Imagem/build |
| --- | --- | --- |
| `postgres` | 5432 | `postgres:16-alpine` |
| `rabbitmq` | 5672, 15672 (UI) | `rabbitmq:3-management-alpine` |
| `vendure` | 3000 | build `./vendure/apps/server` |
| `middleware` | 8080 | build `./middleware` |
| `payment-service` | 8081 | build `./services/payment-service` |
| `notification-service` | — | build `./services/notification-service` |

`depends_on` com `service_healthy` para postgres e rabbitmq.

---

## 15. Demonstração (obrigatória)

1. Subir tudo: `docker compose up -d`.
2. Criar pedido no Vendure (storefront ou GraphiQL Shop) e transitar pra `ArrangingPayment`.
3. Mostrar:
   - Vendure logando `→ middleware /process-order` com correlation ID.
   - Middleware logando `payment_attempt` e `order_paid`/`order_failed` com **mesmo** correlation ID.
   - Notification Service logando o evento consumido com **mesmo** correlation ID.
4. **Derrubar** o Payment Service: `docker compose stop payment-service`.
5. Repetir o fluxo e mostrar:
   - Retry sendo feito (3 tentativas com backoff visíveis nos logs).
   - Fallback final retornando `PENDING`.
   - Nenhum evento publicado em `order.paid`/`order.failed`.

---

## 16. Como Rodar (Dev Local — sem Docker)

### Pré-requisitos

- Node.js 20+, Docker Desktop, Git.
- Postgres e RabbitMQ via Docker:

```powershell
docker compose up -d postgres rabbitmq
```

### Vendure (server + worker + dashboard + storefront)

```powershell
cd vendure
npm install        # postinstall aplica patch-package automaticamente
npm run dev
```

URLs:
- Storefront: http://localhost:3001
- Admin Dashboard: http://localhost:5173/dashboard (login: `superadmin` / `superadmin`)
- GraphiQL Shop: http://localhost:3000/graphiql/shop
- GraphiQL Admin: http://localhost:3000/graphiql/admin
- Dev mailbox: http://localhost:3000/mailbox

### Middleware

```powershell
cd middleware
npm install
cp .env.example .env   # ajustar hosts pra localhost se necessário
npm run start:dev
```

URL: http://localhost:8080 (`/health` e `/process-order`).

### Testes do middleware

```powershell
cd middleware
npm test
```

---

## 17. Convenções Compartilhadas

Para evitar inconsistências entre as Pessoas:

| Item | Convenção |
| --- | --- |
| Header de correlação | `X-Correlation-ID` (case-insensitive) |
| Header JWT | `Authorization: Bearer <token>` |
| Status code padrão | 200 para resposta com payload de status; 400 para validação; 401 auth |
| Datas em payload | ISO 8601 UTC (`new Date().toISOString()`) |
| Currency | ISO 4217 (3 letras maiúsculas) |
| `total` | número decimal (não centavos), 2 casas |
| Nome de exchange | `orders.events` |
| Tipo de exchange | `topic` |
| Nome de evento | `order.<verbo no passado>` (ex: `order.paid`, `order.failed`) |

---

## 18. Checklist Final

- [x] API REST funcionando (P1)
- [ ] PaymentClient com retry + timeout + fallback (P2)
- [ ] RabbitMQ funcionando + Publisher + Consumer (P3)
- [ ] Logs estruturados Pino com correlation_id (P4)
- [ ] Métricas Prometheus em `/metrics` (P4)
- [ ] JWT + roles protegendo `/process-order` (P5)
- [ ] Docker compose subindo todos os serviços de uma vez (P6)
- [ ] Demo de falha do Payment Service mostrando retry + fallback (todos)

---

## 19. Conclusão

A arquitetura em **TypeScript + NestJS** garante alta produtividade, integração natural com Vendure e boa escalabilidade.

👉 O middleware é o **coração da solução**, não o Vendure.
