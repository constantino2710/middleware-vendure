# Demo ao vivo — Funcionando + Tentativas de ataque
# Roda: .\scripts\demo-ao-vivo.ps1
# Cada passo PAUSA esperando ENTER — você controla o ritmo da apresentação.

$ErrorActionPreference = 'Continue'
$baseUrl = 'http://localhost:8080'

function Pause-Demo {
    param([string]$Mensagem = "Pressione ENTER para o proximo teste...")
    Write-Host ""
    Write-Host "  $Mensagem" -ForegroundColor DarkGray
    [void][Console]::ReadLine()
}

function Titulo {
    param([string]$Texto, [string]$Cor = 'Cyan')
    Write-Host ""
    Write-Host ("=" * 65) -ForegroundColor $Cor
    Write-Host "  $Texto" -ForegroundColor $Cor
    Write-Host ("=" * 65) -ForegroundColor $Cor
}

function TestarHttp {
    param([scriptblock]$Block, [int]$Esperado)
    try {
        $code = & $Block
    } catch {
        $code = [int]$_.Exception.Response.StatusCode
    }
    $cor = if ($code -eq $Esperado) { 'Green' } else { 'Red' }
    $simbolo = if ($code -eq $Esperado) { 'OK ' } else { 'FAIL' }
    Write-Host "  [$simbolo] HTTP $code (esperado: $Esperado)" -ForegroundColor $cor
}

# ========================================================
# SETUP
# ========================================================
Titulo "SETUP - Gerando JWT valido"
Push-Location c:\dev\projeto-arq-sistemas\middleware
$jwt = (npm run generate:jwt --silent | Select-Object -Last 1)
Pop-Location

if (-not $jwt -or $jwt -notmatch '^eyJ') {
    Write-Host "  [FAIL] Nao consegui gerar JWT. Confere se middleware esta rodando." -ForegroundColor Red
    exit 1
}
Write-Host "  JWT gerado: $($jwt.Substring(0,40))..." -ForegroundColor Green
Pause-Demo "Tudo pronto. ENTER para comecar a apresentacao..."

# ========================================================
# PARTE A - FUNCIONANDO
# ========================================================
Titulo "PARTE A.1 - /health publico (sem token)" "Green"
$h = Invoke-RestMethod "$baseUrl/health"
Write-Host "  status:  $($h.status)" -ForegroundColor Green
Write-Host "  uptime:  $([math]::Round($h.uptime, 2))s"
Write-Host ""
Write-Host "  >>> Endpoint publico, sem dependencias, ms de resposta." -ForegroundColor Yellow
Pause-Demo

Titulo "PARTE A.2 - Pedido valido com JWT" "Green"
Write-Host "  Enviando: orderId=ORDER-001, total=199.90, cid=demo-A2"
$res = Invoke-RestMethod -Method POST -Uri "$baseUrl/process-order" `
    -ContentType 'application/json' `
    -Headers @{ Authorization = "Bearer $jwt"; 'X-Correlation-ID' = 'demo-A2' } `
    -Body '{"orderId":"ORDER-001","customerId":"42","total":199.90,"currency":"BRL"}'
Write-Host ""
Write-Host "  Resposta:" -ForegroundColor Green
Write-Host "    status:  $($res.status)"
Write-Host "    message: $($res.message)"
Write-Host ""
Write-Host "  >>> OLHE OS TERMINAIS 2 e 3 (middleware + notification)" -ForegroundColor Yellow
Write-Host "      O ID 'demo-A2' aparece em ambos os logs." -ForegroundColor Yellow
Pause-Demo

Titulo "PARTE A.3 - Metricas Prometheus" "Green"
$metrics = (Invoke-WebRequest "$baseUrl/metrics").Content
$metrics -split "`n" | Where-Object { $_ -match "^(http_requests_total|payment_outcomes_total)" -and $_ -notmatch "^#" } | Select-Object -First 8 | ForEach-Object { Write-Host "  $_" }
Write-Host ""
Write-Host "  >>> Cada chamada que fizemos foi contada automaticamente." -ForegroundColor Yellow
Pause-Demo

Titulo "PARTE A.4 - Rastreabilidade (correlation ID)" "Green"
Write-Host "  Enviando com cid=RASTREIO-XYZ-789..."
$null = Invoke-RestMethod -Method POST -Uri "$baseUrl/process-order" `
    -ContentType 'application/json' `
    -Headers @{ Authorization = "Bearer $jwt"; 'X-Correlation-ID' = 'RASTREIO-XYZ-789' } `
    -Body '{"orderId":"RASTREAR","customerId":"42","total":50,"currency":"BRL"}'
Write-Host ""
Write-Host "  >>> Confira agora os logs do middleware e do notification." -ForegroundColor Yellow
Write-Host "      O ID 'RASTREIO-XYZ-789' aparece em TODOS os servicos." -ForegroundColor Yellow
Write-Host "      Em producao, conseguimos rastrear 1 pedido entre 5 microsservicos." -ForegroundColor Yellow
Pause-Demo

# ========================================================
# PARTE B - TENTATIVAS DE ATAQUE
# ========================================================
Titulo "PARTE B.1 - ATAQUE: sem credenciais" "Red"
Write-Host "  Tentando acessar /process-order sem nenhum token..."
TestarHttp -Esperado 401 -Block {
    (Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" -ContentType 'application/json' -Body '{"orderId":"INVASOR","customerId":"X","total":99999,"currency":"BRL"}').StatusCode
}
Write-Host ""
Write-Host "  >>> Bloqueado antes de chegar no controller." -ForegroundColor Yellow
Write-Host "      Guard global protege TODAS as rotas por padrao." -ForegroundColor Yellow
Pause-Demo

Titulo "PARTE B.2 - ATAQUE: token aleatorio" "Red"
Write-Host "  Mandando 'xpto-token-de-mentira-12345' como token..."
TestarHttp -Esperado 401 -Block {
    (Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" -ContentType 'application/json' -Headers @{Authorization="Bearer xpto-token-de-mentira-12345"} -Body '{"orderId":"X","customerId":"X","total":1,"currency":"BRL"}').StatusCode
}
Write-Host ""
Write-Host "  >>> Tentativa de decodificar como JWT falha imediatamente." -ForegroundColor Yellow
Pause-Demo

Titulo "PARTE B.3 - ATAQUE: JWT assinado com secret CHUTADO" "Red"
$jwtAtacante = (node -e "console.log(require('jsonwebtoken').sign({sub:'atacante',roles:['service']},'eu-chutei-essa-senha'))")
Write-Host "  Token forjado com secret 'eu-chutei-essa-senha'..."
Write-Host "  $($jwtAtacante.Substring(0,50))..."
TestarHttp -Esperado 401 -Block {
    (Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" -ContentType 'application/json' -Headers @{Authorization="Bearer $jwtAtacante"} -Body '{"orderId":"FRAUDE","customerId":"X","total":1,"currency":"BRL"}').StatusCode
}
Write-Host ""
Write-Host "  >>> Assinatura HMAC so bate se conhecer o JWT_SECRET real." -ForegroundColor Yellow
Pause-Demo

Titulo "PARTE B.4 - ATAQUE CRITICO: adulterar payload do JWT valido" "Red"
$partes = $jwt.Split('.')
$payloadFalso = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('{"sub":"hacker","roles":["service","admin","superuser"],"iat":1700000000,"exp":9999999999}')).TrimEnd('=').Replace('+','-').Replace('/','_')
$jwtAdulterado = "$($partes[0]).$payloadFalso.$($partes[2])"
Write-Host "  Peguei o JWT valido, mantive a assinatura, troquei o payload..."
Write-Host "  Inflei meu role pra: service + admin + superuser"
TestarHttp -Esperado 401 -Block {
    (Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" -ContentType 'application/json' -Headers @{Authorization="Bearer $jwtAdulterado"} -Body '{"orderId":"ESCALAR","customerId":"X","total":1,"currency":"BRL"}').StatusCode
}
Write-Host ""
Write-Host "  >>> Ataque CLASSICO de escalada de privilegio." -ForegroundColor Yellow
Write-Host "      Assinatura e calculada sobre header+payload." -ForegroundColor Yellow
Write-Host "      Qualquer alteracao no payload quebra a verificacao." -ForegroundColor Yellow
Pause-Demo

Titulo "PARTE B.5 - ATAQUE: token valido com role insuficiente" "Red"
$jwtUsuario = (node -e "console.log(require('jsonwebtoken').sign({sub:'maria',roles:['customer']},'changeme-dev-token'))")
Write-Host "  Token bem assinado, mas role 'customer' em vez de 'service'..."
TestarHttp -Esperado 403 -Block {
    (Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" -ContentType 'application/json' -Headers @{Authorization="Bearer $jwtUsuario"} -Body '{"orderId":"X","customerId":"X","total":1,"currency":"BRL"}').StatusCode
}
Write-Host ""
Write-Host "  >>> 403 = autenticado mas SEM permissao (vs 401 = nao autenticado)." -ForegroundColor Yellow
Write-Host "      Maria existe, token e dela, mas ela nao pode chamar esse endpoint." -ForegroundColor Yellow
Pause-Demo

Titulo "PARTE B.6 - ATAQUE: JWT expirado" "Red"
$jwtVelho = (node -e "console.log(require('jsonwebtoken').sign({sub:'antigo',roles:['service']},'changeme-dev-token',{expiresIn:'-1h'}))")
Write-Host "  Token corretamente assinado, mas expirou ha 1 hora..."
TestarHttp -Esperado 401 -Block {
    (Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" -ContentType 'application/json' -Headers @{Authorization="Bearer $jwtVelho"} -Body '{"orderId":"X","customerId":"X","total":1,"currency":"BRL"}').StatusCode
}
Write-Host ""
Write-Host "  >>> ignoreExpiration:false na strategy garante isso." -ForegroundColor Yellow
Pause-Demo

Titulo "PARTE B.7 - ATAQUE: injetar campos extras (mass assignment)" "Red"
Write-Host "  Tentando passar admin:true, isVerified:true, bypassCheck:true..."
try {
    Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" `
        -ContentType 'application/json' `
        -Headers @{Authorization="Bearer $jwt"} `
        -Body '{"orderId":"X","customerId":"C","total":1,"currency":"BRL","admin":true,"isVerified":true,"bypassCheck":true}' `
        -ErrorAction Stop | Out-Null
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $body = $reader.ReadToEnd()
    Write-Host "  [OK ] HTTP $code (esperado: 400)" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Erros retornados:" -ForegroundColor Yellow
    ($body | ConvertFrom-Json).message | ForEach-Object { Write-Host "    - $_" }
}
Write-Host ""
Write-Host "  >>> ValidationPipe(forbidNonWhitelisted) rejeita campos fora do DTO." -ForegroundColor Yellow
Pause-Demo

Titulo "PARTE B.8 - ATAQUE: total negativo + SQL injection" "Red"
Write-Host "  Total negativo (tentar creditar conta?)..."
TestarHttp -Esperado 400 -Block {
    (Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" -ContentType 'application/json' -Headers @{Authorization="Bearer $jwt"} -Body '{"orderId":"X","customerId":"C","total":-9999,"currency":"BRL"}').StatusCode
}
Write-Host "  SQL injection na currency: '; DROP TABLE orders; --"
TestarHttp -Esperado 400 -Block {
    (Invoke-WebRequest -Method POST -Uri "$baseUrl/process-order" -ContentType 'application/json' -Headers @{Authorization="Bearer $jwt"} -Body '{"orderId":"X","customerId":"C","total":1,"currency":"; DROP TABLE orders; --"}').StatusCode
}
Write-Host ""
Write-Host "  >>> Validacao explicita do DTO bloqueia valores invalidos." -ForegroundColor Yellow
Pause-Demo

# ========================================================
# PARTE C - RESILIENCIA (opcional)
# ========================================================
$rodar = Read-Host "`nRodar a demo de resiliencia (C.1)? Requer mock em modo 'error'. [s/N]"
if ($rodar -eq 's' -or $rodar -eq 'S') {
    Titulo "PARTE C.1 - Payment caido (retry + fallback)" "Magenta"
    Write-Host "  Antes: pare o mock e suba com 'npm run mock:payment -- error'"
    Read-Host "  Pressione ENTER quando o mock estiver em modo 'error'"

    Write-Host "  Disparando pedido (vai demorar ~7s)..." -ForegroundColor Yellow
    $start = Get-Date
    $res = Invoke-RestMethod -Method POST -Uri "$baseUrl/process-order" `
        -ContentType 'application/json' `
        -Headers @{ Authorization = "Bearer $jwt"; 'X-Correlation-ID' = 'demo-resilience' } `
        -Body '{"orderId":"DOWN","customerId":"C","total":99.9,"currency":"BRL"}'
    $tempo = (Get-Date) - $start

    Write-Host ""
    Write-Host "  Duracao: $([math]::Round($tempo.TotalSeconds, 1))s (esperado ~7s)" -ForegroundColor Green
    Write-Host "  Resposta:"
    Write-Host "    status:  $($res.status)"
    Write-Host "    message: $($res.message)"
    Write-Host ""
    Write-Host "  >>> OLHE o terminal do middleware: 4 linhas WARN com timestamps 1s, 2s, 4s." -ForegroundColor Yellow
    Write-Host "      Mesmo com o pagamento caido, a venda NAO foi perdida." -ForegroundColor Yellow
    Pause-Demo
}

# ========================================================
# FIM
# ========================================================
Titulo "FIM DA DEMO" "Cyan"
Write-Host ""
Write-Host "  Resumo do que foi mostrado:" -ForegroundColor Green
Write-Host "    A.1  Health publico responde rapido"
Write-Host "    A.2  Pedido valido aprovado"
Write-Host "    A.3  Metricas Prometheus contando"
Write-Host "    A.4  Rastreabilidade end-to-end"
Write-Host "    B.1  Bloqueia sem token"
Write-Host "    B.2  Bloqueia token aleatorio"
Write-Host "    B.3  Bloqueia JWT com secret errado"
Write-Host "    B.4  Bloqueia JWT adulterado (escalada de privilegio)"
Write-Host "    B.5  403 vs 401 (autz vs autn)"
Write-Host "    B.6  Bloqueia JWT expirado"
Write-Host "    B.7  ValidationPipe rejeita campos extras"
Write-Host "    B.8  Validacao de DTO impede SQLi e valores invalidos"
if ($rodar -eq 's' -or $rodar -eq 'S') {
    Write-Host "    C.1  Resiliencia: retry + fallback PENDING"
}
Write-Host ""
