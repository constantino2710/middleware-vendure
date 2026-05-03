# 📘 Documento Técnico — Divisão de Responsabilidades do Middleware Distribuído

> **Como usar este documento:** cada Pessoa tem uma seção autocontida com (a) status, (b) o que precisa fazer, (c) onde plugar no código que já existe, (d) o contrato de integração e (e) como testar. Antes de começar, leia [contexto-geral.md](contexto-geral.md) inteiro.

---

## 1. Visão Geral

Divisão para garantir paralelismo no desenvolvimento e clareza de responsabilidades.

| Pessoa   | Papel           | Status |
| -------- | --------------- | ------ |
| Pessoa 1 | Core Middleware (orquestração) | 🟢 100% pronto |
| Pessoa 2 | Resiliência + HTTP Client      | 🔴 a fazer |
| Pessoa 3 | Mensageria (RabbitMQ)          | 🔴 a fazer |
| Pessoa 4 | Observabilidade (logs/métricas)| 🔴 a fazer |
| Pessoa 5 | Segurança (JWT + roles)        | 🔴 a fazer |
| Pessoa 6 | Integração Vendure + Infra     | 🟡 Vendure pronto; falta serviços |

🟢 pronto · 🟡 parcial · 🔴 a fazer

---

## 2. Princípios para todos

- **Não invadir o escopo de outra Pessoa** — se precisar de algo dela, abra um stub mínimo e deixe um TODO.
- **Sempre rodar `npm run build` e `npm test`** antes de subir PR.
- **Logar com correlation ID** em qualquer ponto que tocar requisições — quando P4 entregar o Pino, é só trocar a injeção de logger.
- **Branch por funcionalidade**, PR pra revisão, commits pequenos.
- **Variáveis sensíveis em `.env`** (gitignored). Adicione novas variáveis no `.env.example` correspondente.

---

## 3. Pessoa 1 — Core Middleware (Orquestração)  🟢 PRONTO

### 🎯 Responsabilidade

Bootstrap da aplicação, endpoint `POST /process-order`, orquestração do fluxo entre PaymentClient (P2) e Publisher (P3).

### ✅ O que está implementado

| Arquivo | Conteúdo |
| --- | --- |
| [middleware/src/main.ts](../middleware/src/main.ts) | Bootstrap NestJS + ValidationPipe global |
| [middleware/src/app.module.ts](../middleware/src/app.module.ts) | ConfigModule + HealthController + OrderController + OrderService |
| [middleware/src/config/configuration.ts](../middleware/src/config/configuration.ts) | `AppConfig` tipado, token DI `APP_CONFIG` |
| [middleware/src/controllers/dto/process-order.dto.ts](../middleware/src/controllers/dto/process-order.dto.ts) | DTO + Response types com `class-validator` |
| [middleware/src/controllers/order.controller.ts](../middleware/src/controllers/order.controller.ts) | `POST /process-order`, HTTP 200, lê `X-Correlation-ID` |
| [middleware/src/controllers/health.controller.ts](../middleware/src/controllers/health.controller.ts) | `GET /health` |
| [middleware/src/services/order.service.ts](../middleware/src/services/order.service.ts) | Orquestração + tokens DI `PAYMENT_CLIENT` e `PUBLISHER` (com `@Optional()`) |
| [middleware/src/services/order.service.spec.ts](../middleware/src/services/order.service.spec.ts) | 6 testes unitários |

### 🔌 Pontos de extensão deixados pra outras Pessoas

- `PAYMENT_CLIENT` token (string) — P2 registra `{ provide: PAYMENT_CLIENT, useClass: PaymentClient }` no `app.module.ts`.
- `PUBLISHER` token (string) — P3 registra `{ provide: PUBLISHER, useClass: PublisherService }`.
- Controller hoje sem `@UseGuards` — P5 adiciona ou registra como `APP_GUARD` global.
- Logger é o builtin do Nest — P4 troca por `PinoLogger` via `LoggerModule`.

### 🧪 Como testar

```powershell
cd middleware
npm test                  # 6/6 unit tests
npm run start:dev
# em outro terminal
curl.exe http://localhost:8080/health
curl.exe -X POST http://localhost:8080/process-order `
  -H "Content-Type: application/json" `
  -H "X-Correlation-ID: test-1" `
  --data-raw '{"orderId":"X","customerId":"C","total":10,"currency":"BRL"}'
```

Resposta esperada: `{"status":"PENDING","message":"payment client unavailable"}` enquanto P2 não plugar.

### 📦 Entregas

- [x] Endpoint `POST /process-order` funcional
- [x] Validação de input
- [x] Endpoint `GET /health`
- [x] Tratamento de erro do PaymentClient (try/catch → PENDING)
- [x] Testes unitários
- [x] Integração end-to-end com Vendure validada

---

## 4. Pessoa 2 — Resiliência + HTTP Client  🔴 A FAZER

### 🎯 Responsabilidade

Implementar o cliente HTTP que conversa com o Payment Service, garantindo retry, timeout e fallback.

### 📌 Tarefas

#### 4.1 Implementar a interface `PaymentClient` que P1 já espera

Em [middleware/src/clients/payment.client.ts](../middleware/src/clients/payment.client.ts):

```ts
import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import pRetry from 'p-retry';
import { PaymentClient, PaymentResult } from '../services/order.service';

@Injectable()
export class HttpPaymentClient implements PaymentClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: process.env.PAYMENT_SERVICE_URL,
      timeout: 2000,
    });
  }

  async pay(orderId: string, total: number): Promise<PaymentResult> {
    try {
      const res = await pRetry(
        () => this.http.post('/pay', { orderId, amount: total }),
        { retries: 3, minTimeout: 1000, factor: 2 },  // 1s, 2s, 4s
      );
      return { status: res.data.status === 'approved' ? 'approved' : 'declined' };
    } catch (err) {
      return { status: 'fallback', message: (err as Error).message };
    }
  }
}
```

#### 4.2 Registrar o provider em [app.module.ts](../middleware/src/app.module.ts)

```ts
import { HttpPaymentClient } from './clients/payment.client';
import { PAYMENT_CLIENT } from './services/order.service';

providers: [
  OrderService,
  { provide: PAYMENT_CLIENT, useClass: HttpPaymentClient },
],
```

A partir desse momento, `POST /process-order` para de retornar `PENDING (payment client unavailable)` e passa a chamar o serviço de pagamento de verdade.

### 🔧 Configuração

Variável já existe em `middleware/.env`:

```
PAYMENT_SERVICE_URL=http://localhost:8081
```

### 🧪 Como testar

1. **Unit test** — mockar axios e validar:
   - approved → resultado `approved`
   - declined → resultado `declined`
   - timeout/erro → 3 retries com backoff e resultado `fallback`
2. **Integração local** — subir um stub do payment-service (ou um mock-server tipo `json-server`/`mockoon`) na porta 8081 e bater no middleware.
3. **Demo de falha** — derrubar o payment-service e verificar que o middleware faz 3 tentativas (logs com timestamps espaçados ~1s, ~2s, ~4s) e responde `PENDING`.

### 📦 Entregas

- [ ] `HttpPaymentClient` implementando a interface `PaymentClient`
- [ ] Provider registrado no `app.module.ts`
- [ ] Retry 3x com backoff exponencial 1s → 2s → 4s
- [ ] Timeout de 2s por requisição
- [ ] Fallback retornando `{ status: 'fallback' }` (que P1 mapeia pra `PENDING`)
- [ ] Testes unitários do client com axios mockado

---

## 5. Pessoa 3 — Mensageria (RabbitMQ)  🔴 A FAZER

### 🎯 Responsabilidade

Comunicação assíncrona — publicar eventos no middleware e consumir no notification-service.

### 📌 Tarefas

#### 5.1 Subir o RabbitMQ

```powershell
docker compose up -d rabbitmq
```

UI de gestão: http://localhost:15672 (login: `guest`/`guest`).

#### 5.2 Publisher no middleware

Em [middleware/src/messaging/publisher.service.ts](../middleware/src/messaging/publisher.service.ts):

```ts
import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { Publisher } from '../services/order.service';

@Injectable()
export class RabbitMqPublisher implements Publisher {
  constructor(private readonly amqp: AmqpConnection) {}

  async publish(routingKey: string, payload: Record<string, unknown>): Promise<void> {
    await this.amqp.publish('orders.events', routingKey, payload);
  }
}
```

#### 5.3 Registrar `RabbitMQModule` em [app.module.ts](../middleware/src/app.module.ts)

```ts
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { RabbitMqPublisher } from './messaging/publisher.service';
import { PUBLISHER } from './services/order.service';

imports: [
  ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
  RabbitMQModule.forRoot(RabbitMQModule, {
    exchanges: [{ name: 'orders.events', type: 'topic' }],
    uri: process.env.RABBITMQ_URL,
    connectionInitOptions: { wait: true },
  }),
],
providers: [
  OrderService,
  { provide: PUBLISHER, useClass: RabbitMqPublisher },
],
```

#### 5.4 Consumer no notification-service

Em `services/notification-service/src/`:

- Importar `RabbitMQModule` apontando pro mesmo `orders.events`.
- Criar handler com `@RabbitSubscribe({ exchange: 'orders.events', routingKey: ['order.paid', 'order.failed'], queue: 'notifications' })`.
- Logar a mensagem (com `correlation_id`) e — opcional — gravar em arquivo/console.

#### 5.5 Bônus

- **Idempotência:** persistir IDs já consumidos (Redis ou arquivo) e ignorar duplicatas.
- **Dead-letter queue:** configurar `x-dead-letter-exchange` para erros de processamento.
- **Retry com `nack(requeue=false)`** + DLX.

### 🔧 Configuração

Variáveis no `.env`:

```
RABBITMQ_URL=amqp://guest:guest@localhost:5672/
```

### 🧪 Como testar

1. **Sanity:** subir RabbitMQ e abrir http://localhost:15672 → ver exchange `orders.events` criada após o middleware subir.
2. **Publish manual:** rodar o middleware com PaymentClient mockado retornando `approved` e verificar:
   - mensagem aparece em `Queues > notifications` (após o consumer estar de pé) com routing key `order.paid`.
   - payload contém `orderId`, `status`, `timestamp` e `correlation_id`.
3. **End-to-end:** disparar pedido pelo Vendure, ver `payment_attempt` no middleware, ver evento publicado, ver consumer logando.

### 📦 Entregas

- [ ] RabbitMQ rodando via compose
- [ ] Exchange `orders.events` (topic) criada na inicialização
- [ ] Publisher publicando `order.paid` e `order.failed`
- [ ] Notification Service consumindo as duas routing keys
- [ ] Correlation ID propagado no payload da mensagem

---

## 6. Pessoa 4 — Observabilidade  🔴 A FAZER

### 🎯 Responsabilidade

Logs estruturados, propagação de correlation ID e métricas Prometheus.

### 📌 Tarefas

#### 6.1 Trocar o logger builtin por Pino

```ts
// main.ts
import { Logger } from 'nestjs-pino';
const app = await NestFactory.create(AppModule, { bufferLogs: true });
app.useLogger(app.get(Logger));
```

```ts
// app.module.ts
import { LoggerModule } from 'nestjs-pino';
imports: [
  LoggerModule.forRoot({
    pinoHttp: {
      level: process.env.LOG_LEVEL ?? 'info',
      genReqId: (req) =>
        req.headers['x-correlation-id']?.toString() ?? crypto.randomUUID(),
      customProps: () => ({ service: 'middleware' }),
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty' }
        : undefined,
    },
  }),
  // ...
],
```

Substituir `Logger` builtin do Nest por `PinoLogger` injetado no `OrderService` (uma linha por classe — vai reusar o mesmo logger.contextual com correlation_id automaticamente via `pino-http`).

#### 6.2 Correlation Interceptor (HTTP downstream e mensageria)

Em [middleware/src/middlewares/correlation.interceptor.ts](../middleware/src/middlewares/correlation.interceptor.ts):

- Usar `AsyncLocalStorage` (`node:async_hooks`) para guardar o correlation ID por request.
- Expor um `CorrelationContextService` que P2 e P3 chamam pra pegar o cid corrente e injetar no header HTTP / payload da mensagem.

#### 6.3 Métricas Prometheus

Em `middleware/src/controllers/metrics.controller.ts`:

```ts
import { Controller, Get, Header } from '@nestjs/common';
import { register } from 'prom-client';

@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', register.contentType)
  metrics() { return register.metrics(); }
}
```

E criar coletores em algum `MetricsService`:

- `Counter('http_requests_total', { labelNames: ['route', 'status'] })`
- `Histogram('http_request_duration_seconds', { labelNames: ['route'] })`
- `Counter('payment_outcomes_total', { labelNames: ['status'] })` — incrementar em `OrderService` (precisa adicionar uma dependência opcional do MetricsService nele, ou usar event emitter).

#### 6.4 Bônus

- Subir Prometheus + Grafana via docker-compose.
- Importar dashboard pronto pra Node.js metrics.

### 🧪 Como testar

1. Logs: rodar middleware e ver logs em JSON com `correlation_id`, `req.id`, `service`.
2. Correlation: chamar com `-H "X-Correlation-ID: abc"` e ver `abc` no log da requisição **e** no log que P3 emite quando publica a mensagem.
3. Métricas: `curl http://localhost:8080/metrics` deve trazer texto Prometheus (linhas começando com `# HELP`).

### 📦 Entregas

- [ ] Logs Pino estruturados com correlation_id automático
- [ ] Interceptor garantindo propagação do cid
- [ ] `GET /metrics` exposto
- [ ] Pelo menos 3 métricas custom (latência, outcomes, requests)

---

## 7. Pessoa 5 — Segurança  🔴 A FAZER

### 🎯 Responsabilidade

Autenticação JWT e autorização por roles no middleware.

### 📌 Tarefas

#### 7.1 JWT Auth Guard

Em [middleware/src/middlewares/jwt-auth.guard.ts](../middleware/src/middlewares/jwt-auth.guard.ts):

```ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }
  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    return isPublic || super.canActivate(ctx);
  }
}
```

E `JwtStrategy` extendendo `PassportStrategy(Strategy)` lendo o segredo de `process.env.JWT_SECRET`.

#### 7.2 Roles Guard + decorator

Em [middleware/src/middlewares/roles.decorator.ts](../middleware/src/middlewares/roles.decorator.ts) e [roles.guard.ts](../middleware/src/middlewares/roles.guard.ts):

```ts
export const Roles = (...roles: ('USER' | 'ADMIN')[]) => SetMetadata('roles', roles);
```

Guard lê `request.user.roles[]` e compara.

#### 7.3 Registrar como guards globais

Em `app.module.ts`:

```ts
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
  // ...
]
```

#### 7.4 Liberar `/health` (e opcionalmente `/metrics`)

Criar `@Public()` decorator e marcar o `HealthController`. Sem isso o Docker healthcheck quebra.

#### 7.5 Garantir que o token do Vendure é aceito

O Vendure manda `Authorization: Bearer <MIDDLEWARE_JWT>` (variável de ambiente em [vendure/apps/server/.env](../vendure/apps/server/.env)). Garanta que o **mesmo `JWT_SECRET`** está no middleware. Para a demo, dá pra usar um JWT gerado com o secret compartilhado e role `USER`.

### 🧪 Como testar

1. **Sem token** → 401.
2. **Token inválido** → 401.
3. **Token válido com role `USER`** em `POST /process-order` → 200.
4. **Token válido com role `USER`** em `GET /metrics` (se restrito a ADMIN) → 403.
5. **`GET /health`** → 200 sem token.

Tokens de teste podem ser gerados com `jsonwebtoken` num script utilitário ou via https://jwt.io.

### 📦 Entregas

- [ ] `JwtAuthGuard` global + `JwtStrategy`
- [ ] `RolesGuard` + decorator `@Roles()`
- [ ] `@Public()` no `/health`
- [ ] Vendure → middleware funcionando com JWT real (não `changeme`)
- [ ] Testes (token válido/inválido, role correta/errada)

---

## 8. Pessoa 6 — Integração com Vendure + Infra  🟡 PARCIAL

### 🎯 Responsabilidade

Garantir que tudo sobe junto via Docker e que o Vendure está integrado.

### ✅ O que já está pronto

| Item | Onde |
| --- | --- |
| Vendure stack rodando localmente | [vendure/](../vendure/) com `npm run dev` |
| Plugin de bridge Vendure → middleware | [middleware-bridge.plugin.ts](../vendure/apps/server/src/plugins/middleware-bridge/middleware-bridge.plugin.ts) |
| Postgres e RabbitMQ definidos no compose | [docker-compose.yml](../docker-compose.yml) |
| Patches do Vendure | [vendure/patches/](../vendure/patches/) |
| `.env.example` do Vendure server e do storefront | [vendure/apps/server/.env.example](../vendure/apps/server/.env.example), [vendure/apps/storefront/.env.example](../vendure/apps/storefront/.env.example) |

### 📌 Tarefas pendentes

#### 8.1 Validar o build dos containers

```powershell
docker compose build
```

Tem que passar para todos os serviços. Hoje provavelmente o Dockerfile do Vendure server precisa de revisão (workspace npm, multi-stage). Atenção a:
- `vendure/apps/server/Dockerfile` deve copiar o `package-lock.json` do **workspace raiz**, não do app, ou rodar `npm install` no contexto certo.
- `middleware/Dockerfile` está OK.

#### 8.2 `docker compose up -d` deve subir tudo limpo

Hoje:
- ✅ Postgres sobe
- ✅ RabbitMQ sobe (quando `up` for chamado nele)
- ❌ Vendure container provavelmente quebra (não testado após mudança do build path)
- ❌ Middleware container só sobe se `npm install` no Dockerfile funcionar (ok, deve funcionar)
- ❌ payment-service e notification-service são esqueletos

Precisa testar end-to-end via container e ajustar Dockerfiles conforme necessário.

#### 8.3 Healthchecks

Adicionar `healthcheck` no compose para `middleware` (usa `GET /health`) e para `payment-service` quando ele tiver um endpoint.

#### 8.4 Variáveis de ambiente

- Trocar todos os `changeme-dev-token` e secrets default por valores via `.env` do compose.
- Documentar variáveis adicionais que P4 introduzir (níveis de log) e P5 (JWT_SECRET único compartilhado).

#### 8.5 Demo

Roteiro pra demo final (parte da entrega):
1. `docker compose up -d`
2. Aguardar healthy (mostrar `docker compose ps`).
3. Abrir storefront, fazer pedido até pagamento.
4. Mostrar logs:
   - Vendure → middleware → payment-service (correlation ID propagado).
   - Middleware publicando em `orders.events`.
   - Notification Service consumindo.
5. `docker compose stop payment-service`.
6. Repetir pedido — mostrar retry + fallback nos logs do middleware.

### 📦 Entregas

- [x] Vendure stack rodando localmente
- [x] Plugin de bridge implementado
- [ ] `docker compose up -d` sobe TODOS os serviços sem erro
- [ ] Healthchecks configurados
- [ ] Roteiro de demo testado
- [ ] README do projeto atualizado com "como rodar tudo"

---

## 9. Mapa de Dependências entre Pessoas

```
P1 (core)  ───── implementa interfaces ─────▶ aguarda P2 e P3
                                              ▲
P2 (HTTP)  ──── registra PAYMENT_CLIENT ──────┘
P3 (msg)   ──── registra PUBLISHER ───────────┘
P4 (logs)  ──── interceptor + Pino ──────────▶ usado por P1, P2, P3
P5 (auth)  ──── guards globais ──────────────▶ protege endpoints de P1
P6 (infra) ──── docker-compose ──────────────▶ orquestra todos
```

**Quem pode trabalhar em paralelo sem bloqueio:** P1 ✅ (pronto), P2, P3, P4, P5 todos podem desenvolver simultaneamente — os pontos de extensão estão prontos. P6 só é capaz de validar o `compose up` quando os outros tiverem buildable.

---

## 10. Boas Práticas

- Cada Pessoa em sua **própria branch** (`feat/p2-payment-client`, `feat/p3-rabbitmq`, ...).
- **Pull Requests pequenos** com descrição da mudança e **prints/exemplos** de teste.
- Commits no padrão **Conventional Commits** (ex: `feat(middleware): add HttpPaymentClient with retry`).
- **Não comitar `.env`** — sempre só `.env.example`.
- Antes de pedir review: `npm run build` e `npm test` passando.
- Atualizar este documento quando entregar — virar 🟢 e linkar arquivos reais.

---

## 11. Checklist Final por Pessoa

### Pessoa 1  🟢

- [x] Endpoint `POST /process-order` funcional
- [x] DTO validado, Health endpoint, testes unitários
- [x] Integração com Vendure validada end-to-end

### Pessoa 2

- [ ] `HttpPaymentClient` registrado no `app.module.ts`
- [ ] Retry 3x com backoff 1-2-4s
- [ ] Timeout 2s
- [ ] Fallback retornando `{ status: 'fallback' }`
- [ ] Testes unitários

### Pessoa 3

- [ ] RabbitMQ rodando via compose
- [ ] Exchange `orders.events` criada
- [ ] Publisher registrado no `app.module.ts`
- [ ] Notification Service consumindo `order.paid`/`order.failed`
- [ ] Correlation ID no payload

### Pessoa 4

- [ ] Pino substituiu logger builtin
- [ ] Correlation ID propagado em logs / HTTP downstream / mensagens
- [ ] `GET /metrics` exposto com pelo menos 3 métricas custom

### Pessoa 5

- [ ] JWT Guard global validando token
- [ ] Roles Guard funcionando
- [ ] `/health` (e opcionalmente `/metrics`) marcados como `@Public()`
- [ ] Vendure consegue chamar `/process-order` com JWT real

### Pessoa 6

- [x] Vendure stack OK em dev local
- [ ] `docker compose up -d` sobe todos os serviços sem erro
- [ ] Healthchecks definidos
- [ ] Demo de retry+fallback validada

---

## 12. Conclusão

Essa divisão garante:

- Paralelismo real no desenvolvimento (todos podem começar agora que P1 abriu os pontos de extensão).
- Cobertura completa dos requisitos da disciplina.
- Clareza na responsabilidade de cada integrante.

👉 O sucesso do projeto depende da integração entre essas partes. **Coordenem nomes de eventos, headers e variáveis de ambiente** — qualquer divergência aqui é a primeira coisa que quebra na demo.
