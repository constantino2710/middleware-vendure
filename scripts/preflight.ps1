# Pre-flight check para a apresentação
# Roda do diretório raiz do projeto: .\scripts\preflight.ps1

$ErrorActionPreference = 'Continue'
$ok = 0
$fail = 0

function Check {
    param([string]$Name, [scriptblock]$Test)
    Write-Host "  " -NoNewline
    try {
        $result = & $Test
        if ($result) {
            Write-Host "[OK]   " -ForegroundColor Green -NoNewline
            Write-Host $Name
            $script:ok++
        } else {
            Write-Host "[FAIL] " -ForegroundColor Red -NoNewline
            Write-Host $Name
            $script:fail++
        }
    } catch {
        Write-Host "[FAIL] " -ForegroundColor Red -NoNewline
        Write-Host "$Name  →  $_"
        $script:fail++
    }
}

function HttpStatus {
    param([string]$Url, [string]$Method = 'GET', [hashtable]$Headers = @{}, [string]$Body)
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $Headers
            ErrorAction = 'Stop'
            TimeoutSec = 5
        }
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = 'application/json'
        }
        $r = Invoke-WebRequest @params
        return $r.StatusCode
    } catch {
        if ($_.Exception.Response) {
            return [int]$_.Exception.Response.StatusCode
        }
        return 0
    }
}

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "  PRE-FLIGHT CHECK - APRESENTACAO" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# -- 1. Infraestrutura --
Write-Host "1. Containers Docker" -ForegroundColor Yellow
Check "Postgres (vendure-postgres)" {
    docker ps --filter "name=vendure-postgres" --filter "status=running" --format "{{.Names}}" | Select-String "vendure-postgres"
}
Check "RabbitMQ (vendure-rabbitmq)" {
    docker ps --filter "name=vendure-rabbitmq" --filter "status=running" --format "{{.Names}}" | Select-String "vendure-rabbitmq"
}

# -- 2. Servicos --
Write-Host ""
Write-Host "2. Servicos rodando" -ForegroundColor Yellow
Check "Middleware (8080) /health" {
    (HttpStatus 'http://localhost:8080/health') -eq 200
}
Check "Vendure server (3000)" {
    (HttpStatus 'http://localhost:3000/health') -eq 200
}
Check "Storefront (3001)" {
    $s = HttpStatus 'http://localhost:3001'
    $s -eq 200 -or $s -eq 307
}
Check "Mock payment (8091)" {
    $body = '{"orderId":"preflight","amount":1}'
    (HttpStatus -Url 'http://localhost:8091/pay' -Method POST -Body $body) -eq 200
}
Check "RabbitMQ Management UI (15672)" {
    (HttpStatus 'http://localhost:15672') -in @(200, 301, 302)
}

# -- 3. Endpoints publicos / protegidos --
Write-Host ""
Write-Host "3. Seguranca (JWT + roles)" -ForegroundColor Yellow
Check "/health respondendo SEM JWT (Publico)" {
    (HttpStatus 'http://localhost:8080/health') -eq 200
}
Check "/metrics respondendo SEM JWT (Publico)" {
    (HttpStatus 'http://localhost:8080/metrics') -eq 200
}
Check "/process-order REJEITA sem JWT (401)" {
    $body = '{"orderId":"X","customerId":"C","total":10,"currency":"BRL"}'
    (HttpStatus -Url 'http://localhost:8080/process-order' -Method POST -Body $body) -eq 401
}

# -- 4. JWT do Vendure -> Middleware --
Write-Host ""
Write-Host "4. JWT compartilhado" -ForegroundColor Yellow
Check "JWT_SECRET no middleware/.env" {
    (Get-Content c:\dev\projeto-arq-sistemas\middleware\.env -ErrorAction SilentlyContinue) -match '^JWT_SECRET='
}
Check "JWT_SECRET no vendure/.env" {
    (Get-Content c:\dev\projeto-arq-sistemas\vendure\apps\server\.env -ErrorAction SilentlyContinue) -match '^JWT_SECRET='
}
Check "JWT_SECRET IGUAL nos dois lados" {
    $mw = ((Get-Content c:\dev\projeto-arq-sistemas\middleware\.env) -match '^JWT_SECRET=').ToString().Split('=', 2)[1]
    $vd = ((Get-Content c:\dev\projeto-arq-sistemas\vendure\apps\server\.env) -match '^JWT_SECRET=').ToString().Split('=', 2)[1]
    $mw -eq $vd
}

# -- 5. Funcional - JWT em acao --
Write-Host ""
Write-Host "5. JWT em acao" -ForegroundColor Yellow

# Gera JWT
$jwt = $null
try {
    Push-Location c:\dev\projeto-arq-sistemas\middleware
    $jwt = (npm run generate:jwt --silent 2>$null | Select-Object -Last 1)
    Pop-Location
} catch { Pop-Location }

if ($jwt) {
    Check "Geracao de JWT (npm run generate:jwt)" { $true }
    Check "/process-order ACEITA com JWT valido" {
        $body = '{"orderId":"PF1","customerId":"C","total":10,"currency":"BRL"}'
        (HttpStatus -Url 'http://localhost:8080/process-order' -Method POST -Body $body `
            -Headers @{ Authorization = "Bearer $jwt"; 'X-Correlation-ID' = 'preflight' }) -eq 200
    }
    Check "/process-order REJEITA JWT com secret errado" {
        $bad = (node -e "console.log(require('jsonwebtoken').sign({sub:'x',roles:['service']},'secret-errado'))")
        $body = '{"orderId":"PF2","customerId":"C","total":10,"currency":"BRL"}'
        (HttpStatus -Url 'http://localhost:8080/process-order' -Method POST -Body $body `
            -Headers @{ Authorization = "Bearer $bad" }) -eq 401
    }
} else {
    Check "Geracao de JWT (npm run generate:jwt)" { $false }
}

# -- 6. Testes automatizados (rapidos) --
Write-Host ""
Write-Host "6. Testes automatizados" -ForegroundColor Yellow
Push-Location c:\dev\projeto-arq-sistemas\middleware
$unit = npm test --silent 2>&1 | Select-String "Tests:.*passed"
Pop-Location
Check "Unit tests (npm test)" { $unit -match "passed" }

# -- Resultado --
Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
$total = $ok + $fail
if ($fail -eq 0) {
    Write-Host "  TUDO OK: $ok/$total" -ForegroundColor Green
    Write-Host "  Voce esta pronto para apresentar!" -ForegroundColor Green
} else {
    Write-Host "  FALHAS: $fail/$total" -ForegroundColor Red
    Write-Host "  Corrija os itens [FAIL] antes de apresentar" -ForegroundColor Red
}
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""
