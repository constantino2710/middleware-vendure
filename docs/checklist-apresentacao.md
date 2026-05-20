# ✅ Checklist final — Pré-apresentação

> Use este checklist 30 min antes de apresentar. Marca cada item conforme valida. Se algum falhar, há instrução de fix.

---

## ⚡ Atalho — script automático

Rodar **uma única vez** pra validar tudo de uma só vez:

```powershell
cd c:\dev\projeto-arq-sistemas
.\scripts\preflight.ps1
```

Saída esperada no final:
```
TUDO OK: 18/18
Voce esta pronto para apresentar!
```

Se aparecer algum `[FAIL]`, siga o checklist abaixo pra corrigir o item específico.

---

## 📋 Checklist manual (camada por camada)

### Fase 1 — Infraestrutura (containers Docker)

- [ ] `docker ps` mostra `vendure-postgres` com `(healthy)`
- [ ] `docker ps` mostra `vendure-rabbitmq` com `(healthy)`

**Se não rodando:**
```powershell
docker start vendure-postgres vendure-rabbitmq
# ou primeira vez:
docker compose up -d postgres rabbitmq
```

---

### Fase 2 — Suba os 4 serviços

Abra **4 terminais separados** e rode um comando em cada:

| Terminal | Comando | Pronto quando aparecer |
|---|---|---|
| **1 — Mock payment** | `cd middleware ; $env:MOCK_PAYMENT_PORT=8091 ; npm run mock:payment -- approved` | `[mock] payment-service em http://localhost:8091  mode=approved` |
| **2 — Middleware** | `cd middleware ; npm run start:dev` | `Nest application successfully started` |
| **3 — Notification** | `cd services\notification-service ; npm run start:dev` | `NotificationConsumer.handleOrderEvent {subscribe} -> orders.events::order.paid,order.failed::notifications` |
| **4 — Vendure** | `cd vendure ; npm run dev` | `Vendure server (v3.6.2) now running on port 3000` |

---

### Fase 3 — Verifique cada endpoint

Num quinto terminal, valida cada um:

- [ ] **Middleware health (público):**
  ```powershell
  Invoke-RestMethod http://localhost:8080/health
  ```
  ✅ `status: ok`

- [ ] **Middleware metrics (público):**
  ```powershell
  Invoke-WebRequest http://localhost:8080/metrics | Select-Object -ExpandProperty StatusCode
  ```
  ✅ `200`

- [ ] **Vendure server:**
  ```powershell
  Invoke-WebRequest http://localhost:3000/health | Select-Object -ExpandProperty StatusCode
  ```
  ✅ `200`

- [ ] **Storefront:**
  ```powershell
  Invoke-WebRequest http://localhost:3001 | Select-Object -ExpandProperty StatusCode
  ```
  ✅ `200` ou `307` (redirect de locale)

- [ ] **Mock payment:**
  ```powershell
  Invoke-RestMethod -Method POST -Uri http://localhost:8091/pay -ContentType 'application/json' -Body '{"orderId":"X","amount":1}'
  ```
  ✅ `status: approved`

- [ ] **RabbitMQ UI:** abrir http://localhost:15672 (login `guest`/`guest`)
  ✅ Vê o dashboard

---

### Fase 4 — Segurança (JWT)

- [ ] **Sem JWT retorna 401:**
  ```powershell
  try {
      Invoke-WebRequest -Method POST -Uri http://localhost:8080/process-order `
          -ContentType 'application/json' `
          -Body '{"orderId":"X","customerId":"C","total":10,"currency":"BRL"}' `
          -ErrorAction Stop | Out-Null
  } catch {
      Write-Host "HTTP $($_.Exception.Response.StatusCode.value__)"
  }
  ```
  ✅ `HTTP 401`

- [ ] **JWT_SECRET igual nos dois `.env`:**
  ```powershell
  Get-Content middleware\.env | Select-String '^JWT_SECRET='
  Get-Content vendure\apps\server\.env | Select-String '^JWT_SECRET='
  ```
  ✅ Ambos mostram `JWT_SECRET=changeme-dev-token` (ou qualquer valor, **mas igual**)

- [ ] **Gerar JWT funciona:**
  ```powershell
  cd middleware
  npm run generate:jwt
  ```
  ✅ Imprime um token gigante começando com `eyJ...`

- [ ] **JWT válido retorna 200:**
  ```powershell
  $jwt = (cd middleware; npm run generate:jwt --silent | Select-Object -Last 1)
  Invoke-RestMethod -Method POST -Uri http://localhost:8080/process-order `
      -ContentType 'application/json' `
      -Headers @{ Authorization = "Bearer $jwt"; 'X-Correlation-ID' = 'check-1' } `
      -Body '{"orderId":"PF1","customerId":"C","total":10,"currency":"BRL"}'
  ```
  ✅ Retorna `status: SUCCESS, message: payment approved`

---

### Fase 5 — Fluxo completo via GraphiQL

- [ ] Janela anônima em http://localhost:3000/graphiql/shop
- [ ] **Logout antes (limpa sessão anterior):**
  ```graphql
  mutation { logout { success } }
  ```
- [ ] **Mutation 1 — addItem:** retorna `code` e `state: AddingItems`
- [ ] **Mutation 2 — setCustomer:** retorna `code`
- [ ] **Mutation 3 — setShippingAddress:** retorna `code`
- [ ] **Mutation 4 — setShippingMethod:** retorna `state: AddingItems`
- [ ] **Mutation 5 — transitionOrderToState("ArrangingPayment"):** retorna `state: ArrangingPayment`
- [ ] **No exato momento da mutation 5:** os 4 terminais ganham logs com **mesmo `cid`**
- [ ] **Resposta no Vendure:** `body={"status":"SUCCESS","message":"payment approved"}`

---

### Fase 6 — Resiliência (opcional, mas impressiona)

- [ ] Para mock (Ctrl+C no Terminal 1)
- [ ] Sobe mock em modo erro:
  ```powershell
  $env:MOCK_PAYMENT_PORT=8091
  npm run mock:payment -- error
  ```
- [ ] Refaz a mutation 5 (com novo carrinho)
- [ ] Demora **~7 segundos**
- [ ] **Middleware mostra 4 linhas** `payment retry` com timestamps espaçados (1s/2s/4s)
- [ ] **Final: status PENDING** com mensagem do erro 500

---

### Fase 7 — Mensageria (RabbitMQ)

- [ ] Volta mock pra modo `approved`
- [ ] Refaz a mutation 5 (novo carrinho)
- [ ] **Terminal 3 (notification)** mostra log JSON com `correlation_id` igual aos outros terminais
- [ ] **Em http://localhost:15672 → Queues → `notifications`:** contador de mensagens incrementou

---

## 🛡️ Defesas de demo (plano B pronto)

### Se a storefront pedir login e a verificação de e-mail não funcionar
→ Use **GraphiQL** (já testou, funciona)

### Se o JWT_SECRET divergir
→ Edita os dois `.env` pra ter `JWT_SECRET=changeme-dev-token`, reinicia o Vendure E o middleware

### Se algum `EADDRINUSE` aparecer
→ Mata o zumbi:
```powershell
foreach ($p in 8080,8081,8091,3000,3001,5173) {
    $pid = (Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue).OwningProcess
    if ($pid) { Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue }
}
```

### Se o middleware crashar
→ Limpa cache e reinicia:
```powershell
cd middleware
Remove-Item -Recurse -Force dist, tsconfig.tsbuildinfo -ErrorAction SilentlyContinue
npm run start:dev
```

### Se nada subir
→ Cai pro Plano D: roda só `npm run test:all` no middleware (42 testes), mostra GitHub Actions verde no projetor, e explica o que cada teste prova.

---

## 🎤 Antes de subir ao palco

- [ ] **3 abas abertas no navegador:**
  - http://localhost:3001 (storefront)
  - http://localhost:3000/graphiql/shop (GraphiQL, em janela anônima)
  - http://localhost:15672 (RabbitMQ UI, login `guest`/`guest`)

- [ ] **Editor com 2 arquivos abertos** (pra mostrar o JWT):
  - `vendure/apps/server/src/plugins/middleware-bridge/middleware-bridge.plugin.ts`
  - `middleware/src/auth/strategies/jwt.strategy.ts`

- [ ] **5 terminais visíveis** (4 dos serviços + 1 de teste/curl)

- [ ] **jwt.io aberto numa aba** (pra decodificar JWT visualmente)

- [ ] **Mutations colados num Notepad** (pra colar rápido sem ter que digitar)

- [ ] **Sua história ensaiada** (1 vez em voz alta, ajuda demais)

---

## 🏆 Critério de sucesso da apresentação

Em ordem de impacto:

1. ✅ **O mesmo `cid` apareceu nos 4 terminais** ← prova rastreabilidade
2. ✅ **Resposta `SUCCESS` HTTP 200** ← prova JWT + fluxo
3. ✅ **(Variação) Retry com backoff 1s→2s→4s visível** ← prova resiliência
4. ✅ **Fila do RabbitMQ contou +1** ← prova mensageria
5. ✅ **42 testes verdes no terminal** ← prova qualidade

Se 1, 2 e 5 derem certo, a apresentação **está garantida**.
