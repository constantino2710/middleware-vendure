# Como testar o middleware

> Guia organizado em **4 camadas** de teste, da mais rápida (segundos) à mais completa (cenário real com Vendure). Use a camada certa para a pergunta que você quer responder.

---

## Visão geral

| # | Camada | Roda em | O que valida | Quando usar |
|---|---|---|---|---|
| 1 | **Unit tests** | ~3s, automático | Lógica isolada de cada peça | Sempre — em CI e localmente |
| 2 | **E2E in-memory** | ~5s, automático | Middleware inteiro (segurança, validação, fluxo) | Antes de cada PR |
| 3 | **Integração com mock** | ~30s, manual | Middleware + mock real do payment | Ao mexer na Pessoa 2 ou em retry/timeout |
| 4 | **Integração com Vendure** | ~5min, manual | Sistema completo (Vendure → middleware → mock) | Antes da demo / quando mexer no plugin |

**Total automatizado hoje: 41 testes (28 unit + 13 E2E).**

---

## Camada 1 — Unit tests (28 testes)

Testam cada classe isolada, com mocks de tudo que é externo. **Não precisa subir nada.**

```powershell
cd middleware
npm test
```

### O que cobre

| Suíte | Quem cobre | # |
|---|---|---|
| `services/order.service.spec.ts` | P1 — orquestração (sem PaymentClient, aprovado, recusado, fallback, exceção, sem Publisher) | 6 |
| `controllers/order.controller.spec.ts` | P1 — header X-Correlation-ID, geração de UUID, retorno da response | 3 |
| `controllers/health.controller.spec.ts` | P1 — endpoint /health | 1 |
| `controllers/dto/process-order.dto.spec.ts` | P1 — validação class-validator (8 cenários de erro + 1 ok + múltiplos campos) | 10 |
| `config/configuration.spec.ts` | P1 — config tipada, defaults, conversão de tipos | 3 |
| `clients/payment.client.spec.ts` | P2 — approved, declined, retry com 500, formato inesperado, timeout | 5 |
| **Total** | | **28** |

### Critério de sucesso

Saída termina com: `Tests: 28 passed, 28 total`.

---

## Camada 2 — E2E in-memory (13 testes)

Sobe o **middleware completo em memória** com Jest + supertest. Bate em endpoints HTTP de verdade, passa pela pipeline real (guards, pipes, controllers, service), mas com o `PaymentClient` substituído por um stub.

**Vantagem sobre unit tests:** valida que tudo está bem _wired_ no `AppModule`, incluindo `JwtAuthGuard`, `RolesGuard`, `ValidationPipe` global.

```powershell
cd middleware
npm run test:e2e
```

### O que cobre

#### `GET /health`
- 200 sem JWT (`@Public()` funcionando)

#### `POST /process-order` — Segurança (P5)
- 401 sem `Authorization`
- 401 com JWT inválido (assinatura errada)
- 403 com JWT válido mas sem role `service`
- 403 sem nenhum role no token

#### `POST /process-order` — Validação (P1)
- 400 com corpo vazio
- 400 com `total` negativo
- 400 com currency fora do ISO 4217
- 400 com campo extra (whitelist)

#### `POST /process-order` — Fluxo (P1 + P2 mockado)
- 200 SUCCESS quando PaymentClient aprova
- 200 FAILED quando PaymentClient recusa
- 200 PENDING quando PaymentClient cai em fallback
- 200 PENDING quando PaymentClient lança exceção

### Critério de sucesso

Saída termina com: `Tests: 13 passed, 13 total`.

### Rodar tudo (unit + E2E) de uma vez

```powershell
npm run test:all
```

---

## Camada 3 — Integração com mock (manual)

Testa **o middleware rodando de verdade** (não em memória) chamando **um mock real do payment-service** (em outro processo). Valida o `HttpPaymentClient` da Pessoa 2 com retry/timeout/backoff reais.

### Setup (3 terminais)

**Terminal A — mock do payment-service:**

```powershell
cd middleware
$env:MOCK_PAYMENT_PORT=8091
npm run mock:payment -- approved
```

> Troque `approved` por `declined`, `error` ou `timeout` para outros cenários.

**Terminal B — middleware:**

```powershell
cd middleware
npm run start:dev
```

**Terminal C — disparar:**

```powershell
$jwt = (Get-Content c:\dev\projeto-arq-sistemas\vendure\apps\server\.env | Select-String '^MIDDLEWARE_JWT=').Line.Split('=', 2)[1]

Invoke-RestMethod -Method Post -Uri http://localhost:8080/process-order `
  -ContentType 'application/json' `
  -Headers @{ 'Authorization' = "Bearer $jwt"; 'X-Correlation-ID' = 'manual-1' } `
  -Body '{"orderId":"M1","customerId":"C1","total":100,"currency":"BRL"}'
```

### Resultado esperado por cenário

| Modo do mock | Resposta | Duração | Logs do middleware |
|---|---|---|---|
| `approved` | `status: SUCCESS` | ~100ms | 1× `payment_attempt`, sem retry |
| `declined` | `status: FAILED` | ~100ms | 1× `payment_attempt`, sem retry |
| `error` | `status: PENDING` | **~7s** | 4× `payment retry` (attemptsLeft=3,2,1,0) + 1× `payment fallback` |
| `timeout` | `status: PENDING` | **~14s** | 4× `payment retry` com `timeout of 2000ms exceeded` |

### Critério de sucesso

Resposta + tempo + número de logs batem com a tabela acima. O `cid` aparece em todos os logs (rastreabilidade).

---

## Camada 4 — Integração com Vendure (manual)

Reproduz o **cenário de produção**: cliente faz pedido na loja, Vendure aciona middleware automaticamente.

### Setup (4 terminais)

**Terminal 0 — Postgres:**

```powershell
docker start vendure-postgres
docker ps   # confirmar "Up X (healthy)"
```

**Terminal A — Vendure (server + worker + dashboard + storefront):**

```powershell
cd vendure
npm run dev
```

Aguarde aparecer: `Vendure server (v3.6.2) now running on port 3000`.

**Terminal B — mock do payment-service:**

```powershell
cd middleware
$env:MOCK_PAYMENT_PORT=8091
npm run mock:payment -- approved
```

**Terminal C — middleware:**

```powershell
cd middleware
npm run start:dev
```

### Disparar pelo GraphiQL

Abra **janela anônima** (Ctrl+Shift+N) e vá em http://localhost:3000/graphiql/shop. Cole **uma mutation por vez**:

```graphql
mutation { addItemToOrder(productVariantId: "1", quantity: 1) {
  ... on Order { id code state totalWithTax }
  ... on ErrorResult { errorCode message } } }
```

```graphql
mutation { setCustomerForOrder(input: {
  emailAddress: "teste@example.com", firstName: "Joao", lastName: "Teste"
}) { ... on Order { id code } ... on ErrorResult { errorCode message } } }
```

```graphql
mutation { setOrderShippingAddress(input: {
  fullName: "Joao Teste", streetLine1: "Rua A, 123",
  city: "São Paulo", province: "SP",
  postalCode: "01000-000", countryCode: "BR"
}) { ... on Order { id code } ... on ErrorResult { errorCode message } } }
```

```graphql
mutation { setOrderShippingMethod(shippingMethodId: ["1"]) {
  ... on Order { id code state }
  ... on ErrorResult { errorCode message } } }
```

```graphql
# DISPARA o middleware
mutation { transitionOrderToState(state: "ArrangingPayment") {
  ... on Order { id code state totalWithTax }
  ... on OrderStateTransitionError { errorCode message } } }
```

### Critério de sucesso

Após executar a última mutation, **o mesmo correlation ID** deve aparecer nos 3 terminais simultaneamente:

| Terminal | Log esperado |
|---|---|
| Vendure | `→ middleware /process-order order=XXX cid=YYY` + `← middleware status=200 cid=YYY body={"status":"SUCCESS",...}` |
| Middleware | `payment_attempt order=XXX total=Z USD cid=YYY` |
| Mock | `[mock] POST /pay body={"orderId":"XXX","amount":Z}` |

Se o `cid` for o mesmo nos 3 → ✅ integração ponta-a-ponta funcionando.

---

## Tabela de diagnóstico

| Sintoma | Camada | Causa provável | Como resolver |
|---|---|---|---|
| Unit test falha | 1 | Lógica de uma classe quebrada | Ler o erro do Jest, fixar |
| E2E test falha | 2 | Wiring no `AppModule` ou pipeline | Ler stack, geralmente é provider faltando |
| Manual com mock: 401 | 3 | JWT do `.env` do Vendure não bate com `JWT_SECRET` do middleware | `cd middleware && npm run generate:jwt` e atualizar Vendure |
| Manual com mock: middleware loga mas mock não recebe | 3 | Porta errada | Confirmar `MOCK_PAYMENT_PORT=8091` e `PAYMENT_SERVICE_URL=http://localhost:8091` |
| Vendure: `middleware status=401` | 4 | Mesmo do anterior | Regenerar JWT |
| Vendure: `ECONNREFUSED` | 4 | Middleware não está rodando | Subir middleware |
| GraphiQL: `OrderStateTransitionError` no passo 6 | 4 | Algum passo anterior falhou | Releia respostas dos passos 1-5 |
| GraphiQL: `ALREADY_LOGGED_IN_ERROR` no passo 2 | 4 | Sessão admin compartilhando cookie | Usar janela anônima |
| `Cannot find module dist/main` | 1/2/3 | Cache do TypeScript | `rm -rf dist tsconfig.tsbuildinfo` e rebuild (mas já desligamos `incremental`) |
| `EADDRINUSE` | 3/4 | Processo zumbi na porta | `Get-NetTCPConnection -State Listen -LocalPort XXXX` + `Stop-Process` |

---

## Resumo dos comandos

```powershell
cd middleware

# Camada 1: rápida
npm test                          # 28 unit tests

# Camada 2: rápida
npm run test:e2e                  # 13 E2E in-memory
npm run test:all                  # ambas (41 testes)

# Camada 3: manual com mock
npm run mock:payment -- approved  # ou: declined / error / timeout
npm run start:dev
# em outro terminal: curl/Invoke-RestMethod

# Camada 4: manual com Vendure
# requer Vendure rodando + mock + middleware + GraphiQL
```

---

## Estado atual do que está coberto

| Pessoa | Tem testes? | Tipo |
|---|---|---|
| P1 — Core | ✅ Sim | 23 unit + 13 E2E |
| P2 — Resiliência | ✅ Sim | 5 unit |
| P3 — Mensageria | ❌ Não (P3 não implementada) | — |
| P4 — Observabilidade | ❌ Não (P4 não implementada) | — |
| P5 — Segurança | ✅ Sim (via E2E) | 4 E2E |
| P6 — Infra (Vendure ↔ middleware) | ✅ Sim | Camada 4 manual |

Quando P3 e P4 entregarem, deve-se adicionar suítes de teste correspondentes.
