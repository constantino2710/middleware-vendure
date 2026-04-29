# 📘 Especificação Técnica — Middleware Distribuído (TypeScript + Vendure)

---

## 1. Visão Geral

Este documento define a implementação de um middleware distribuído em **TypeScript (Node.js)** responsável por integrar o **Vendure** com serviços externos.

**Objetivos:**

- Orquestrar processamento de pedidos
- Garantir comunicação síncrona e assíncrona
- Implementar resiliência (retry + fallback)
- Garantir observabilidade (logs + métricas)
- Aplicar segurança (JWT + roles)

👉 O Vendure atua como **fonte de eventos**
👉 O middleware é o **núcleo da arquitetura**

---

## 2. Stack Tecnológica

### 🔧 Linguagem

- **TypeScript (Node.js)** — OBRIGATÓRIO

### 🧠 Framework Backend

- **NestJS (RECOMENDADO)**
  - Arquitetura modular
  - Suporte nativo a DI
  - Ideal para microsserviços

### 🌐 HTTP Client

- `fetch` (nativo Node 18+) ou `axios`

### 📨 Mensageria

- **RabbitMQ**
- Lib:
  - `amqplib`
  - ou `@golevelup/nestjs-rabbitmq`

### 📊 Observabilidade

- **Logs:** `pino`
- **Métricas:** `prom-client`
- **Tracing (opcional):** OpenTelemetry

### 🔐 Segurança

- **JWT** → `@nestjs/jwt` ou `jsonwebtoken`

### 🐳 Infra

- Docker + docker-compose

---

## 3. Arquitetura

```
Vendure → Middleware → Payment Service
                     ↓
                  RabbitMQ
                     ↓
             Notification Service
```

---

## 4. Estrutura do Projeto

```
/services
  /payment-service
    /src
  /notification-service
    /src

/middleware
  /src
    /controllers
    /services
    /clients
    /messaging
    /middlewares
    /config
    /utils
    main.ts

/docker
docker-compose.yml
package.json
tsconfig.json
README.md
```

---

## 5. Integração com Vendure

### Plugin no Vendure

```ts
eventBus.ofType(OrderStateTransitionEvent).subscribe(event => {
  fetch("http://middleware:8080/process-order", {
    method: "POST",
    body: JSON.stringify({
      orderId: event.order.id,
      customerId: event.order.customer?.id,
      total: event.order.totalWithTax,
      currency: event.order.currencyCode
    })
  })
})
```

---

## 6. Middleware — API

### Endpoint

```
POST /process-order
```

### DTO (TypeScript)

```ts
export interface ProcessOrderDTO {
  orderId: string
  customerId: string
  total: number
  currency: string
}
```

### Response

```ts
export interface ProcessOrderResponse {
  status: "SUCCESS" | "FAILED" | "PENDING"
  message: string
}
```

### Headers

```
Authorization: Bearer <JWT>
X-Correlation-ID: <optional>
```

---

## 7. Payment Service

### Endpoint

```
POST /pay
```

### DTO

```ts
export interface PaymentRequest {
  orderId: string
  amount: number
}

export interface PaymentResponse {
  status: "approved" | "declined"
}
```

---

## 8. Comunicação Assíncrona

### Exchange

```
orders.events
```

### Routing Keys

- `order.paid`
- `order.failed`

### Evento

```ts
export interface OrderEvent {
  orderId: string
  status: "PAID" | "FAILED"
  timestamp: string
}
```

---

## 9. Fluxo Completo

1. Vendure cria pedido
2. Plugin envia para middleware
3. Middleware:
   - gera `correlationId` (uuid)
   - valida JWT (guard NestJS)
   - chama Payment Service (HTTP)
4. Payment responde
5. Middleware:
   - sucesso → publica `order.paid`
   - falha → retry → fallback
6. Notification Service consome evento

---

## 10. Resiliência

### Estratégia

- **Retry:** 3 tentativas
- **Backoff:** 1s → 2s → 4s
- **Timeout:** 2 segundos

### Implementação (Node)

- **Retry:** `p-retry`
- **Timeout:** axios/fetch config
- **Circuit breaker (opcional):** `opossum`

---

## 11. Observabilidade

### Logs

```json
{
  "correlation_id": "abc123",
  "service": "middleware",
  "event": "payment_attempt",
  "status": "success"
}
```

**Logger:** `pino`

### Correlation ID

- Gerado com `uuid`
- Propagado para:
  - Payment Service
  - RabbitMQ

### Métricas

Endpoint:

```
GET /metrics
```

Exemplo:

```json
{
  "requests": 120,
  "errors": 5,
  "avg_latency_ms": 200
}
```

---

## 12. Segurança

### JWT

- Validação via Guard (NestJS)
- Secret via ENV:

```
JWT_SECRET=secret
```

### Roles

- **USER** → envia pedidos
- **ADMIN** → acesso total

---

## 13. Tolerância a Falhas

### Cenários

#### Payment Service indisponível

- Retry automático
- fallback → `PENDING`

#### RabbitMQ indisponível

- Log + retry posterior

#### Vendure indisponível

- Middleware rejeita requisição

---

## 14. Docker Compose

Serviços:

- vendure
- middleware
- payment-service
- rabbitmq
- notification-service

---

## 15. Demonstração (Obrigatória)

1. Criar pedido no Vendure
2. Middleware processa
3. Derrubar Payment Service
4. Mostrar:
   - retry funcionando
   - fallback
   - logs com correlation ID

---

## 16. Checklist Final

- [ ] API REST funcionando
- [ ] RabbitMQ funcionando
- [ ] Retry implementado
- [ ] Timeout configurado
- [ ] Logs estruturados
- [ ] Correlation ID
- [ ] JWT + roles
- [ ] Docker rodando

---

## 17. Conclusão

A arquitetura em **TypeScript + NestJS** garante:

- Alta produtividade
- Integração natural com Vendure
- Facilidade de manutenção
- Boa escalabilidade

👉 O middleware continua sendo o **coração da solução**, não o Vendure.
