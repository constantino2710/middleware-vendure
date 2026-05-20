# 🎬 Demo ao vivo — Bateria completa de testes

> Sequência de testes que demonstra todas as capacidades do middleware. Cada teste responde uma pergunta sobre o sistema. Os comandos rodam direto no PowerShell — copia e cola.

---

## 📊 Tabela-resumo

| # | Pergunta respondida | Comando | Esperado |
|---|---|---|---|
| **0** | Tudo está testado? | `npm run test:all` | 42 ✓ |
| **1** | Está vivo? | `GET /health` | 200 + `ok` |
| **2** | Aceita um pedido válido? | `POST` com JWT correto | 200 + `SUCCESS` |
| **3** | Consegue rastrear o pedido? | `POST` com X-Correlation-ID | mesmo `cid` em 3 terminais |
| **4** | Rejeita dados inválidos? | `POST` com DTO mal formado | 400 + lista de erros |
| **5** | Bloqueia campos extras? | `POST` com `admin:true` injetado | 400 + erro nominal |
| **6** | Bloqueia chamada sem credencial? | `POST` sem token | 401 |
| **7** | Detecta token forjado? | `POST` com JWT adulterado | 401 |
| **8** | Bloqueia permissão errada? | `POST` com role `customer` | 403 |
| **9** | Sobrevive a falha do parceiro? | `POST` com payment caído | PENDING em ~7s |
| **10** | Mediu tudo automaticamente? | `GET /metrics` | contadores Prometheus |

> **Bônus** ao final pra cobrir mais cenários (token aleatório, JWT expirado, SQL injection, secret chutado).

---

## ⚙️ Setup — antes de começar a testar

### Passo 1 — Containers de infra (Postgres + RabbitMQ)

```powershell
docker ps
```

✅ Tem que aparecer `vendure-postgres` e `vendure-rabbitmq` com status `Up (healthy)`.

Se não tiver:
```powershell
docker start vendure-postgres vendure-rabbitmq
```

Se nem existir (primeira vez):
```powershell
cd c:\dev\projeto-arq-sistemas
docker compose up -d postgres rabbitmq
```

### Passo 2 — Sobe os 3 serviços (em 3 terminais separados)

| Terminal | Comando | Pronto quando aparecer |
|---|---|---|
| **1 — Mock do pagamento** | `cd c:\dev\projeto-arq-sistemas\middleware ; $env:MOCK_PAYMENT_PORT=8091 ; npm run mock:payment -- approved` | `[mock] payment-service em http://localhost:8091  mode=approved` |
| **2 — Middleware** | `cd c:\dev\projeto-arq-sistemas\middleware ; npm run start:dev` | `Nest application successfully started` |
| **3 — Notification-service** | `cd c:\dev\projeto-arq-sistemas\services\notification-service ; npm run start:dev` | `NotificationConsumer.handleOrderEvent {subscribe} -> orders.events::order.paid,order.failed::notifications` |

Deixa esses 3 terminais visíveis durante toda a apresentação — vários testes mostram **logs aparecendo neles em tempo real**.

### Passo 3 — Num **quarto terminal**, prepara o JWT

Esse é onde você vai rodar todos os testes daqui pra frente:

```powershell
cd c:\dev\projeto-arq-sistemas\middleware
$baseUrl = 'http://localhost:8080'
$jwt = (npm run generate:jwt --silent | Select-Object -Last 1)
Write-Host "JWT pronto: $($jwt.Substring(0,30))..." -ForegroundColor Cyan
```

### ✅ Esperado
```
JWT pronto: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Passo 4 — Confirma que tudo está respondendo (smoke check)

Antes de começar os testes oficiais, valida que tudo está vivo:
```powershell
Invoke-RestMethod "$baseUrl/health"
```
✅ Deve retornar `status: ok`.

Se der erro de conexão, o middleware ainda não subiu — espera mais alguns segundos.

> Agora sim, **pode começar pelos testes (0 a 10)**.

---

## 0️⃣ Tudo está testado? → 42 testes automatizados

```powershell
Write-Host "`n=== 0: bateria automatizada ===" -ForegroundColor Cyan
cd c:\dev\projeto-arq-sistemas\middleware
npm run test:all
```

🎤 **"Antes de mostrar manualmente, vamos confirmar que existem 42 testes automatizados cobrindo todos os caminhos: validação, orquestração, retry, segurança, fluxo HTTP completo. Esses testes rodam no GitHub Actions a cada commit."**

### ✅ Esperado
```
Test Suites: 6 passed, 6 total
Tests:       29 passed, 29 total      ← unit tests

Test Suites: 1 passed, 1 total
Tests:       13 passed, 13 total      ← E2E
```

📝 **Critério:** 42 verdes em ~8 segundos.

---

## 1️⃣ Está vivo? → Health check

```powershell
Write-Host "`n=== 1: /health publico ===" -ForegroundColor Cyan
Measure-Command { Invoke-RestMethod "$baseUrl/health" } | Select-Object TotalMilliseconds
Invoke-RestMethod "$baseUrl/health"
```

🎤 **"Endpoint público para healthcheck do Docker. Sem token, sem dependências externas, resposta em milissegundos."**

### ✅ Esperado
```
=== 1: /health publico ===
TotalMilliseconds
-----------------
            42.31

status uptime
------ ------
ok     6312.4
```

📝 **Critério:** `status: ok` e duração <100ms.

---

## 2️⃣ Aceita um pedido válido? → Caminho feliz

```powershell
Write-Host "`n=== 2: pedido valido ===" -ForegroundColor Cyan
$res = Invoke-RestMethod -Method POST -Uri "$baseUrl/process-order" `
    -ContentType 'application/json' `
    -Headers @{ Authorization = "Bearer $jwt"; 'X-Correlation-ID' = 'demo-2' } `
    -Body '{"orderId":"ORDER-001","customerId":"42","total":199.90,"currency":"BRL"}'
$res | Format-List
```

🎤 **"Com token válido e dados corretos, o middleware orquestra todo o fluxo: autenticação, validação, chamada ao serviço de pagamento, e publicação de evento na fila. O resultado SUCCESS prova que todas as peças se comunicaram."**

### ✅ Esperado no PowerShell
```
status  : SUCCESS
message : payment approved
```

### ✅ Logs do middleware
```
INFO  payment_attempt order=ORDER-001 total=199.9 BRL cid=demo-2
```

### ✅ Logs do notification-service
```
INFO  {"correlation_id":"demo-2","event":"order_event_received","orderId":"ORDER-001","status":"PAID"}
```

📝 **Critério:** `SUCCESS` no PowerShell + mesmo `cid=demo-2` nos logs dos 3 serviços.

---

## 3️⃣ Consegue rastrear o pedido? → Correlation ID

```powershell
Write-Host "`n=== 3: rastreabilidade end-to-end ===" -ForegroundColor Cyan
Invoke-RestMethod -Method POST -Uri "$baseUrl/process-order" `
    -ContentType 'application/json' `
    -Headers @{ Authorization = "Bearer $jwt"; 'X-Correlation-ID' = 'RASTREIO-XYZ-789' } `
    -Body '{"orderId":"RASTREAR","customerId":"42","total":50,"currency":"BRL"}'
```

🎤 **"Mandei um identificador único `RASTREIO-XYZ-789` no header. Olhem os logs agora — o mesmo ID aparece nos 3 serviços. Em produção, isso permite seguir um pedido específico entre microsserviços diferentes para debug."**

### ✅ PowerShell
```
status  message
------  -------
SUCCESS payment approved
```

### ✅ Middleware
```
INFO  payment_attempt order=RASTREAR total=50 BRL cid=RASTREIO-XYZ-789
```

### ✅ Notification
```
INFO  {"correlation_id":"RASTREIO-XYZ-789",...}
```

📝 **Critério:** o ID **literal** `RASTREIO-XYZ-789` aparece nos 3 lugares.

---

## 4️⃣ Rejeita dados inválidos? → Validação do DTO

```powershell
Write-Host "`n=== 4: DTO mal formado ===" -ForegroundColor Red
try {
    Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" `
        -ContentType 'application/json' `
        -Headers @{ Authorization = "Bearer $jwt" } `
        -Body '{"total":-5,"currency":"BRAZIL"}' `
        -ErrorAction Stop | Out-Null
} catch {
    Write-Host "  Bloqueado: HTTP $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host "  Erros de validacao:" -ForegroundColor Yellow
    ($reader.ReadToEnd() | ConvertFrom-Json).message | ForEach-Object { Write-Host "    - $_" }
}
```

🎤 **"Mandei um pedido com `orderId` faltando, `customerId` faltando, total negativo e currency com 6 letras. O middleware rejeita com 400 antes de chegar na lógica de negócio, **listando exatamente o que está errado**."**

### ✅ Esperado
```
=== 4: DTO mal formado ===
  Bloqueado: HTTP 400
  Erros de validacao:
    - orderId should not be empty
    - orderId must be a string
    - customerId should not be empty
    - customerId must be a string
    - total must be a positive number
    - currency must be shorter than or equal to 3 characters
```

📝 **Critério:** HTTP 400 + lista nominal de cada problema.

---

## 5️⃣ Bloqueia campos extras? → Mass assignment

```powershell
Write-Host "`n=== 5: campos extras (injecao) ===" -ForegroundColor Red
$payload = '{"orderId":"X","customerId":"C","total":1,"currency":"BRL","admin":true,"isVerified":true,"bypassCheck":true}'

try {
    Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" `
        -ContentType 'application/json' `
        -Headers @{ Authorization = "Bearer $jwt" } `
        -Body $payload `
        -ErrorAction Stop | Out-Null
} catch {
    Write-Host "  Bloqueado: HTTP $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    Write-Host "  Mensagem:" -ForegroundColor Yellow
    ($reader.ReadToEnd() | ConvertFrom-Json).message | ForEach-Object { Write-Host "    - $_" }
}
```

🎤 **"Tentei injetar campos como `admin: true`, `isVerified`, `bypassCheck` na esperança que algum código aceitasse. O ValidationPipe com `forbidNonWhitelisted` rejeita imediatamente qualquer campo fora do DTO declarado."**

### ✅ Esperado
```
=== 5: campos extras (injecao) ===
  Bloqueado: HTTP 400
  Mensagem:
    - property admin should not exist
    - property isVerified should not exist
    - property bypassCheck should not exist
```

📝 **Critério:** HTTP 400 + cada campo extra listado nominalmente.

---

## 6️⃣ Bloqueia chamada sem credencial? → Autenticação

```powershell
Write-Host "`n=== 6: sem credencial ===" -ForegroundColor Red
try {
    Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" `
        -ContentType 'application/json' `
        -Body '{"orderId":"INVASOR","customerId":"X","total":99999,"currency":"BRL"}' `
        -ErrorAction Stop | Out-Null
} catch {
    Write-Host "  Bloqueado: HTTP $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
}
```

🎤 **"Sem token, bloqueado com 401 antes mesmo de chegar no controller. Guard global protege todas as rotas por padrão — pra liberar uma rota, é preciso marcar explicitamente como pública (como o /health)."**

### ✅ Esperado
```
=== 6: sem credencial ===
  Bloqueado: HTTP 401
```

📝 **Critério:** HTTP 401 (Unauthorized).

---

## 7️⃣ Detecta token forjado? → 🔥 Adulteração de JWT

```powershell
Write-Host "`n=== 7: JWT adulterado (escalada de privilegio) ===" -ForegroundColor Red

# Pega o JWT valido, mantem assinatura, troca payload pra escalar privilegio
$partes = $jwt.Split('.')
$payloadFalso = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('{"sub":"hacker","roles":["service","admin","superuser"],"iat":1700000000,"exp":9999999999}')).TrimEnd('=').Replace('+','-').Replace('/','_')
$jwtAdulterado = "$($partes[0]).$payloadFalso.$($partes[2])"

Write-Host "  Mantive a assinatura, troquei o payload pra dar admin+superuser..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" `
        -ContentType 'application/json' `
        -Headers @{ Authorization = "Bearer $jwtAdulterado" } `
        -Body '{"orderId":"ESCALAR","customerId":"X","total":1,"currency":"BRL"}' `
        -ErrorAction Stop | Out-Null
} catch {
    Write-Host "  Bloqueado: HTTP $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
}
```

🎤 **"Esse é o ataque clássico de escalada de privilégio. Peguei um JWT válido, mantive a assinatura original, e modifiquei o payload para inflar minhas permissões. A assinatura HMAC é calculada sobre header+payload — qualquer alteração quebra a verificação."**

### ✅ Esperado
```
=== 7: JWT adulterado (escalada de privilegio) ===
  Mantive a assinatura, troquei o payload pra dar admin+superuser...
  Bloqueado: HTTP 401
```

📝 **Critério:** HTTP 401 — **🎯 É O TESTE MAIS IMPACTANTE.**

---

## 8️⃣ Bloqueia permissão errada? → Autorização

```powershell
Write-Host "`n=== 8: role insuficiente ===" -ForegroundColor Red
$jwtUsuario = (node -e "console.log(require('jsonwebtoken').sign({sub:'maria',roles:['customer']},'changeme-dev-token'))")
Write-Host "  Token assinado corretamente, mas role 'customer' em vez de 'service'"

try {
    Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" `
        -ContentType 'application/json' `
        -Headers @{ Authorization = "Bearer $jwtUsuario" } `
        -Body '{"orderId":"X","customerId":"X","total":1,"currency":"BRL"}' `
        -ErrorAction Stop | Out-Null
} catch {
    Write-Host "  Bloqueado: HTTP $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
}
```

🎤 **"Diferente do teste anterior: aqui o token está corretamente autenticado, mas a Maria não tem permissão para esse endpoint. **401 = não autenticado. 403 = autenticado, mas sem permissão.**"**

### ✅ Esperado
```
=== 8: role insuficiente ===
  Token assinado corretamente, mas role 'customer' em vez de 'service'
  Bloqueado: HTTP 403
```

📝 **Critério:** HTTP **403** (não 401). Mostra a diferença autenticação vs autorização.

---

## 9️⃣ Sobrevive a falha do parceiro? → Resiliência

**Antes:** pare o mock (Ctrl+C no terminal dele) e suba em modo erro:
```powershell
$env:MOCK_PAYMENT_PORT=8091
npm run mock:payment -- error
```

Depois roda:
```powershell
Write-Host "`n=== 9: payment caido — sistema resiste ===" -ForegroundColor Magenta
$start = Get-Date
$res = Invoke-RestMethod -Method POST -Uri "$baseUrl/process-order" `
    -ContentType 'application/json' `
    -Headers @{ Authorization = "Bearer $jwt"; 'X-Correlation-ID' = 'demo-resilience' } `
    -Body '{"orderId":"DOWN","customerId":"C","total":99.9,"currency":"BRL"}'
$tempo = (Get-Date) - $start
Write-Host ""
Write-Host "Duracao: $($tempo.TotalSeconds) segundos" -ForegroundColor Yellow
$res | Format-List
```

🎤 **(Enquanto demora os ~7s):** "Olhem os logs do middleware agora. Tentando, esperando, tentando... 1s, 2s, 4s. Backoff exponencial. Mesmo com o pagamento totalmente caído, a venda vira PENDING — não é perdida. O cliente final pode ser notificado depois ou o pedido ser reprocessado."

### ✅ Esperado no PowerShell
```
=== 9: payment caido — sistema resiste ===

Duracao: 7.124 segundos

status  : PENDING
message : Request failed with status code 500
```

### ✅ Logs do middleware
```
INFO   payment_attempt order=DOWN total=99.9 BRL cid=demo-resilience
WARN   payment retry order=DOWN attemptsLeft=3 err=...                ← imediato
WARN   payment retry order=DOWN attemptsLeft=2 err=...                ← +1s
WARN   payment retry order=DOWN attemptsLeft=1 err=...                ← +2s
WARN   payment retry order=DOWN attemptsLeft=0 err=...                ← +4s
ERROR  payment fallback order=DOWN err=...
```

### ✅ Logs do mock
```
[mock] POST /pay  body={"orderId":"DOWN","amount":99.9}    ← 4 vezes
```

📝 **Critério:**
- Duração ~7 segundos (1+2+4s de backoff)
- `status: PENDING`
- 4 linhas WARN com `attemptsLeft` decrescendo

**Voltar ao normal:** Ctrl+C no mock e suba com `npm run mock:payment -- approved`.

---

## 🔟 Mediu tudo automaticamente? → Observabilidade

```powershell
Write-Host "`n=== 10: metricas Prometheus ===" -ForegroundColor Cyan
(Invoke-WebRequest "$baseUrl/metrics").Content | Select-String "payment_outcomes|http_requests" -Context 0,0
```

🎤 **"Cada chamada que fizemos hoje incrementou esses contadores automaticamente. Em produção, Prometheus faria scrape disso a cada 15 segundos e alimentaria dashboards. Os outcomes são separados — um alerta dispararia se `fallback` aumentasse de forma anormal, ou seja, saberíamos do problema antes do cliente reclamar."**

### ✅ Esperado
```
=== 10: metricas Prometheus ===
# HELP http_requests_total Total de requisições HTTP recebidas
# TYPE http_requests_total counter
http_requests_total{route="/process-order",status="200"} 3
http_requests_total{route="/process-order",status="401"} 3
http_requests_total{route="/process-order",status="403"} 1
http_requests_total{route="/process-order",status="400"} 2
# HELP payment_outcomes_total Resultado das tentativas de pagamento
# TYPE payment_outcomes_total counter
payment_outcomes_total{status="approved"} 2
payment_outcomes_total{status="fallback"} 1
```

📝 **Critério:** contadores separados por status HTTP **e** por outcome de pagamento. Prova que a observabilidade está funcionando.

---

# 🎁 BÔNUS — Ataques adicionais se sobrar tempo

Saída esperada de todos: `Bloqueado: HTTP <código>`.

## Bônus 1 — Token aleatório (não é JWT)

```powershell
Write-Host "`n=== Bonus: token fake ===" -ForegroundColor Red
try {
    Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" `
        -ContentType 'application/json' `
        -Headers @{ Authorization = "Bearer xpto-token-de-mentira-12345" } `
        -Body '{"orderId":"X","customerId":"X","total":1,"currency":"BRL"}' `
        -ErrorAction Stop | Out-Null
} catch {
    Write-Host "  Bloqueado: HTTP $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
}
```
✅ `Bloqueado: HTTP 401` (não decodifica como JWT).

---

## Bônus 2 — JWT assinado com secret chutado

```powershell
Write-Host "`n=== Bonus: JWT com secret errado ===" -ForegroundColor Red
$jwtAtacante = (node -e "console.log(require('jsonwebtoken').sign({sub:'atacante',roles:['service']},'eu-chutei-essa-senha'))")
try {
    Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" `
        -ContentType 'application/json' `
        -Headers @{ Authorization = "Bearer $jwtAtacante" } `
        -Body '{"orderId":"FRAUDE","customerId":"X","total":1,"currency":"BRL"}' `
        -ErrorAction Stop | Out-Null
} catch {
    Write-Host "  Bloqueado: HTTP $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
}
```
✅ `Bloqueado: HTTP 401` (assinatura HMAC não bate).

---

## Bônus 3 — JWT expirado

```powershell
Write-Host "`n=== Bonus: JWT expirado ===" -ForegroundColor Red
$jwtVelho = (node -e "console.log(require('jsonwebtoken').sign({sub:'antigo',roles:['service']},'changeme-dev-token',{expiresIn:'-1h'}))")
try {
    Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" `
        -ContentType 'application/json' `
        -Headers @{ Authorization = "Bearer $jwtVelho" } `
        -Body '{"orderId":"X","customerId":"X","total":1,"currency":"BRL"}' `
        -ErrorAction Stop | Out-Null
} catch {
    Write-Host "  Bloqueado: HTTP $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
}
```
✅ `Bloqueado: HTTP 401` (`ignoreExpiration: false` ativa).

---

## Bônus 4 — SQL injection na currency

```powershell
Write-Host "`n=== Bonus: SQL injection ===" -ForegroundColor Red
try {
    Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" `
        -ContentType 'application/json' `
        -Headers @{ Authorization = "Bearer $jwt" } `
        -Body '{"orderId":"X","customerId":"C","total":1,"currency":"; DROP TABLE orders; --"}' `
        -ErrorAction Stop | Out-Null
} catch {
    Write-Host "  Bloqueado: HTTP $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Yellow
}
```
✅ `Bloqueado: HTTP 400` (currency deve ter 3 caracteres).

---

# 🤖 Versão automatizada

Se preferir rodar **tudo de uma vez** com pausas entre cada teste:

```powershell
cd c:\dev\projeto-arq-sistemas
.\scripts\demo-ao-vivo.ps1
```

Roda em sequência, aperta ENTER entre cada teste, marca `[OK ]` verde ou `[FAIL]` vermelho.

---

# 🚨 Plano B — se algo travar

| Sintoma | Resolver |
|---|---|
| `$jwt` vazio | `cd middleware ; npm run generate:jwt` manualmente, copia, define `$jwt = "valor-copiado"` |
| Middleware caiu | `cd middleware ; npm run start:dev` |
| Mock caiu | `cd middleware ; $env:MOCK_PAYMENT_PORT=8091 ; npm run mock:payment -- approved` |
| `EADDRINUSE` | `foreach ($p in 8080,8081,8091) { $pid=(Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue).OwningProcess; if($pid){Stop-Process -Id $pid -Force} }` |
| HTTP diferente do esperado | Confere se `JWT_SECRET` está IGUAL em `middleware/.env` e `vendure/apps/server/.env` |
