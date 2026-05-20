# 🛍️ Como testar o middleware **pela loja virtual** (sem terminal)

> Guia visual para demonstrar o fluxo completo navegando pelo site, como um cliente real faria. Ideal para apresentação ao professor — você abre o navegador e mostra acontecendo.

---

## ✅ O que esse teste prova

Em uma compra real na loja, **todo o trabalho dos 6 integrantes acontece automaticamente**:

- ✅ O cliente entra no site (P6 — Vendure)
- ✅ Adiciona produtos ao carrinho
- ✅ Termina o pedido — esse passo dispara o **plugin do Vendure** (P6)
- ✅ Que **assina um JWT em runtime** (P5 — segurança)
- ✅ Envia pro **middleware** (P1 — núcleo)
- ✅ Que valida a segurança (P5)
- ✅ Chama o serviço de pagamento (P2 — resiliência)
- ✅ Publica evento na fila (P3 — mensageria)
- ✅ Tudo isso instrumentado com logs e métricas (P4 — observabilidade)

---

## 📦 O que precisa estar rodando antes

### 1. Containers de infra

```powershell
docker start vendure-postgres vendure-rabbitmq
```

(Se não existirem ainda: `docker compose up -d postgres rabbitmq` na raiz do projeto.)

### 2. Serviços (cada um num terminal)

| Terminal | Comando | Quando estiver pronto |
|---|---|---|
| **1 — mock do pagamento** | `cd middleware ; $env:MOCK_PAYMENT_PORT=8091 ; npm run mock:payment -- approved` | Aparece `[mock] payment-service em http://localhost:8091  mode=approved` |
| **2 — middleware** | `cd middleware ; npm run start:dev` | Aparece `Nest application successfully started` |
| **3 — notification (opcional)** | `cd services\notification-service ; npm run start:dev` | Aparece `RabbitMQModule dependencies initialized` |
| **4 — Vendure (loja + admin)** | `cd vendure ; npm run dev` | Aparece `Vendure server (v3.6.2) now running on port 3000` e depois `[storefront] ✓ Ready` |

⚠️ O Vendure demora ~30 segundos pra subir tudo (server + worker + dashboard + storefront).

---

## 🛒 Passo a passo na loja (no navegador)

### Passo 1 — Abrir a loja virtual

Abra uma **janela anônima** (Ctrl+Shift+N no Chrome/Edge) — evita problemas de sessão compartilhada com o painel admin.

Vá em:

```
http://localhost:3001
```

✅ Você verá a loja com produtos (catálogo padrão do Vendure).

### Passo 2 — Escolher um produto

Clique em qualquer produto da home. Vai abrir a página dele.

✅ Você verá: nome do produto, foto, preço, descrição, botão "Add to cart" (ou equivalente).

### Passo 3 — Adicionar ao carrinho

Clique no botão **"Add to cart"** ou **"Adicionar ao carrinho"**.

✅ Você verá uma confirmação (geralmente um pop-up ou notificação no topo).

### Passo 4 — Ir para o carrinho

Clique no ícone do carrinho (canto superior direito, geralmente).

✅ Vai abrir a página `/cart` mostrando o produto adicionado.

### Passo 5 — Iniciar checkout

Clique em **"Checkout"** ou **"Finalizar compra"**.

✅ Vai abrir o fluxo de checkout. Vai pedir e-mail e endereço.

### Passo 6 — Preencher dados

Preencha:
- **E-mail:** `demo@example.com`
- **Nome:** `Demo`
- **Sobrenome:** `User`
- **Endereço:** qualquer (ex: `Rua A, 123`)
- **Cidade:** `São Paulo`
- **Estado:** `SP`
- **CEP:** `01000-000`
- **País:** `Brazil` (ou o que aparecer)

Clique em **"Continue"** ou **"Próximo"**.

### Passo 7 — Escolher método de envio

Selecione qualquer método (`Standard Shipping` ou `Express Shipping`).

Clique em **"Continue"** ou **"Próximo"**.

### Passo 8 — 🎯 **AQUI ACONTECE A MÁGICA**

Você vai chegar na etapa de **pagamento**. No instante em que o pedido entra nesse estado, o **Vendure dispara o plugin** que chama o middleware.

✅ **No navegador você verá:** a tela de pagamento (escolha de cartão, etc.) ou uma confirmação de pedido.

---

## 👁️ O que olhar **enquanto** o passo 8 acontece

Mesmo que a ideia seja não usar terminal, vale ter eles **visíveis em segundo plano** durante a apresentação — é a **prova visual** de que tudo está conectado.

### No terminal do Vendure (Terminal 4)

Apareceram **2 linhas novas** logo após você clicar pra ir ao pagamento:

```
[server] info ... [MiddlewareBridgePlugin] → middleware /process-order  order=XXX  cid=YYY
[server] info ... [MiddlewareBridgePlugin] ← middleware status=200 cid=YYY body={"status":"SUCCESS","message":"payment approved"}
```

### No terminal do middleware (Terminal 2)

Apareceu **uma linha estruturada em JSON** (formato Pino — P4):

```json
{
  "level": 30,
  "req": { "id": "YYY", ... },
  "msg": "payment_attempt order=XXX total=Z USD cid=YYY"
}
```

### No terminal do mock (Terminal 1)

Apareceu:

```
[mock] POST /pay  body={"orderId":"XXX","amount":Z}
```

### No terminal do notification (Terminal 3)

Apareceu (também em JSON estruturado):

```json
{
  "correlation_id": "YYY",
  "service": "notification-service",
  "event": "order_event_received",
  "orderId": "XXX",
  "status": "PAID"
}
```

### A prova final

O **mesmo `cid` (correlation ID)** aparece nos **4 terminais**. Isso prova que conseguimos rastrear o pedido inteiro entre os sistemas.

---

## 🎤 Como apresentar isso pro professor

### Setup antes da apresentação

1. Abra os 4 terminais lado a lado (ou em abas).
2. Confira que tudo subiu sem erro.
3. Abra a janela anônima do navegador em http://localhost:3001.
4. Tenha o painel admin aberto numa segunda aba: http://localhost:5173/dashboard (login `superadmin`/`superadmin`).

### Roteiro falado (3 minutos)

> "Vou demonstrar o fluxo **como um cliente real faria**. Vou comprar um produto na loja virtual aqui no navegador, e enquanto faço isso, vocês vão ver nos terminais à direita o sistema inteiro reagindo automaticamente.
>
> [Adiciona produto, vai ao carrinho, checkout, preenche endereço]
>
> Repare nos terminais agora, quando eu clicar pra ir ao pagamento...
>
> [Clica]
>
> Pronto. Em menos de meio segundo, **5 serviços conversaram entre si**:
>
> 1. O **Vendure** detectou que o pedido entrou em estado de pagamento e disparou o plugin de integração.
> 2. O plugin **assinou um JWT em tempo real** com a chave compartilhada e chamou o middleware.
> 3. O **middleware** validou o token, conferiu a permissão, validou os dados do pedido, e chamou o serviço de pagamento.
> 4. O **serviço de pagamento** aprovou (estamos com mock em modo aprovado).
> 5. O **middleware** publicou o evento `order.paid` na fila do RabbitMQ.
> 6. O **serviço de notificação** consumiu o evento e logou.
>
> O mesmo **identificador de rastreamento** [aponta o `cid`] aparece em todos os 4 terminais — é a garantia de que conseguimos seguir um pedido específico atravessando todos os sistemas, o que é essencial para depurar problemas em produção."

### Variação dramática — derrubar o pagamento

Para mostrar **resiliência** em ação:

1. No **Terminal 1** (mock), pare com Ctrl+C.
2. Suba ele em modo erro: `$env:MOCK_PAYMENT_PORT=8091 ; npm run mock:payment -- error`
3. Faça outro pedido pela loja (basta repetir os passos 2-8).
4. Vai demorar ~7 segundos. Enquanto demora, mostre os logs do middleware com **4 tentativas e backoff exponencial**.
5. No fim, o middleware retorna `PENDING` em vez de quebrar.

Diga: "Repare que o sistema não desistiu na primeira falha. Tentou 3 vezes esperando cada vez mais — 1, 2 e 4 segundos. Só então caiu em estado pendente, sem perder o pedido. Em produção isso significa que uma instabilidade momentânea da operadora de cartão não derruba a venda."

---

## 🚨 Possíveis problemas e como resolver na hora

| Sintoma | Causa | Resolver |
|---|---|---|
| Storefront não abre (404 em http://localhost:3001) | Storefront ainda subindo | Espere mais 20s, atualize a página |
| `Add to cart` falha | Sem produtos cadastrados no banco | Use o admin dashboard pra confirmar que existem produtos |
| Trava no checkout em "endereço inválido" | CEP/país no formato errado | Use exatamente os valores sugeridos acima |
| Vendure logs mostram `middleware status=401` | `JWT_SECRET` não está nos dois `.env` | Confira que `vendure/apps/server/.env` e `middleware/.env` têm o **mesmo** `JWT_SECRET` |
| Vendure logs mostram `middleware call failed ECONNREFUSED` | Middleware caiu ou não subiu | Reinicie o Terminal 2 |
| Sem logs no notification service | RabbitMQ não está rodando | `docker start vendure-rabbitmq` |
| Pedido termina sem disparar middleware | Pedido não chegou em `ArrangingPayment` | Algumas storefronts pulam essa transição — use o GraphiQL como fallback |

---

## 🎁 Bônus visual — UI do RabbitMQ

Enquanto demonstra, abra também: **http://localhost:15672** (login `guest` / `guest`).

Vai em **Queues → `notifications`**. Você vê **um contador subindo** a cada pedido aprovado — prova visual da mensageria funcionando.

Mostre também **Exchanges → `orders.events`** pra explicar o desacoplamento.

---

## 📝 Como o JWT é assinado agora (resumo da mudança)

**Antes:** O JWT era gerado uma vez via script e colado manualmente no `.env` do Vendure. Funcionava, mas tinha esse passo manual feio.

**Agora:** O Vendure **assina o JWT em runtime**, no momento da chamada, usando o mesmo `JWT_SECRET` que o middleware usa pra validar. Validade curta (1 hora). Sem passos manuais. Sem JWT vencendo.

```ts
// No plugin do Vendure (middleware-bridge.plugin.ts)
const jwt = sign(
    { sub: 'vendure-bridge', roles: ['service'] },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' },
);
```

Pra que isso funcione, ambos os `.env` precisam ter o mesmo valor:

| Arquivo | Variável |
|---|---|
| `vendure/apps/server/.env` | `JWT_SECRET=changeme-dev-token` |
| `middleware/.env` | `JWT_SECRET=changeme-dev-token` |

Se mudar de lado só, dá 401 em todas as chamadas.
