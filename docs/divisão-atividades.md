# 📘 Documento Técnico — Divisão de Responsabilidades do Middleware Distribuído

---

## 1. Visão Geral

Este documento define a divisão detalhada das responsabilidades para o desenvolvimento do middleware distribuído integrado ao **Vendure**.

O objetivo é garantir:

* Paralelismo no desenvolvimento
* Clareza de responsabilidades
* Cobertura completa dos requisitos da disciplina
* Integração eficiente entre os membros

---

## 2. Estrutura Geral da Equipe

| Pessoa   | Papel           | Área Principal           |
| -------- | --------------- | ------------------------ |
| Pessoa 1 | Core Middleware | Orquestração             |
| Pessoa 2 | Resiliência     | Comunicação síncrona     |
| Pessoa 3 | Mensageria      | Comunicação assíncrona   |
| Pessoa 4 | Observabilidade | Logs e métricas          |
| Pessoa 5 | Segurança       | Auth e autorização       |
| Pessoa 6 | Integração      | Vendure + Infraestrutura |

---

## 3. Pessoa 1 — Core Middleware (Orquestração)

### 🎯 Responsabilidade principal

Implementar o fluxo central do middleware.

---

### 📌 Tarefas

#### 3.1 API

* Criar endpoint:

  ```
  POST /process-order
  ```
* Definir request/response conforme especificação

---

#### 3.2 Fluxo principal

Implementar:

1. Receber requisição do Vendure
2. Validar entrada
3. Gerar correlation ID (se não existir)
4. Chamar Payment Service (via client HTTP)
5. Receber resposta
6. Encaminhar para mensageria

---

#### 3.3 Estrutura do código

Criar:

```
/controllers/orderController
/services/orderService
```

---

### 📦 Entregas

* Endpoint funcional
* Fluxo completo integrado

---

## 4. Pessoa 2 — Resiliência + HTTP Client

### 🎯 Responsabilidade principal

Garantir confiabilidade da comunicação síncrona.

---

### 📌 Tarefas

#### 4.1 HTTP Client

Criar módulo:

```
/clients/paymentClient
```

Função:

```
pay(orderId, amount)
```

---

#### 4.2 Retry

Implementar:

* 3 tentativas
* Backoff exponencial:

  * 1s → 2s → 4s

---

#### 4.3 Timeout

* Configurar timeout de 2 segundos

---

#### 4.4 Tratamento de erros

Tratar:

* Timeout
* HTTP 500
* Serviço indisponível

---

#### 4.5 Fallback

Definir:

* Se falhar → status `PENDING`

---

### 📦 Entregas

* Client resiliente
* Teste com falha simulada

---

## 5. Pessoa 3 — Mensageria (RabbitMQ)

### 🎯 Responsabilidade principal

Implementar comunicação assíncrona.

---

### 📌 Tarefas

#### 5.1 Infraestrutura

* Subir RabbitMQ via Docker

---

#### 5.2 Configuração

Criar:

* Exchange:

  ```
  orders.events
  ```
* Routing keys:

  * `order.paid`
  * `order.failed`

---

#### 5.3 Publisher (Middleware)

Criar módulo:

```
/messaging/publisher
```

Publicar eventos após pagamento

---

#### 5.4 Consumer

Criar Notification Service:

```
/services/notification-service
```

Consumir eventos e logar

---

#### 5.5 (Bônus)

* Garantir idempotência
* Implementar retry na fila

---

### 📦 Entregas

* Evento publicado e consumido
* Fluxo assíncrono funcional

---

## 6. Pessoa 4 — Observabilidade

### 🎯 Responsabilidade principal

Garantir rastreabilidade e monitoramento.

---

### 📌 Tarefas

#### 6.1 Logs estruturados

Formato JSON:

```
{
  "correlation_id": "...",
  "service": "...",
  "event": "...",
  "status": "..."
}
```

---

#### 6.2 Correlation ID

* Gerar (ou receber)
* Propagar em:

  * headers HTTP
  * mensagens na fila

---

#### 6.3 Métricas

Criar:

```
GET /metrics
```

Retornar:

* total de requisições
* erros
* latência média

---

#### 6.4 (Bônus)

* Prometheus
* Grafana

---

### 📦 Entregas

* Logs claros e padronizados
* Métricas acessíveis

---

## 7. Pessoa 5 — Segurança

### 🎯 Responsabilidade principal

Controlar acesso ao middleware.

---

### 📌 Tarefas

#### 7.1 Autenticação

* Implementar JWT
* Validar token em cada requisição

---

#### 7.2 Middleware de auth

Criar:

```
/middleware/authMiddleware
```

---

#### 7.3 Autorização

Implementar roles:

* USER → criar pedidos
* ADMIN → acesso completo

---

#### 7.4 Proteção de endpoints

* `/process-order` protegido

---

### 📦 Entregas

* Sistema de auth funcionando
* Teste com token válido/inválido

---

## 8. Pessoa 6 — Integração com Vendure + Infra

### 🎯 Responsabilidade principal

Conectar sistema real e garantir execução.

---

### 📌 Tarefas

#### 8.1 Vendure

* Subir o Vendure
* Criar plugin:

```ts
eventBus.ofType(OrderStateTransitionEvent)
```

---

#### 8.2 Integração

* Enviar requisição para middleware:

```
POST /process-order
```

---

#### 8.3 Docker

Criar:

```
docker-compose.yml
```

Serviços:

* vendure
* middleware
* payment-service
* rabbitmq
* notification-service

---

#### 8.4 Execução

Garantir:

```
docker-compose up
```

funcione sem erros

---

### 📦 Entregas

* Integração Vendure → Middleware
* Ambiente completo funcionando

---

## 9. Integração entre membros

### Dependências

* Pessoa 1 depende de:

  * Pessoa 2 (client HTTP)
  * Pessoa 3 (mensageria)

* Pessoa 3 depende de:

  * Pessoa 1 (eventos)

* Pessoa 6 conecta tudo

---

## 10. Boas Práticas

* Cada membro deve fazer commits próprios
* Criar branches por funcionalidade
* Revisão via Pull Request
* Testar integração continuamente

---

## 11. Checklist Final por Pessoa

### Pessoa 1

* [ ] Endpoint funcionando
* [ ] Fluxo completo

### Pessoa 2

* [ ] Retry + timeout
* [ ] Fallback

### Pessoa 3

* [ ] RabbitMQ funcionando
* [ ] Eventos publicados

### Pessoa 4

* [ ] Logs JSON
* [ ] Métricas

### Pessoa 5

* [ ] JWT
* [ ] Roles

### Pessoa 6

* [ ] Vendure integrado
* [ ] Docker funcionando

---

## 12. Conclusão

Essa divisão garante:

* Paralelismo real no desenvolvimento
* Cobertura completa dos requisitos
* Clareza na responsabilidade de cada integrante

👉 O sucesso do projeto depende da integração entre essas partes.

---
