# Como o Middleware funciona — explicado de forma simples

> **Para quem é este documento:** pessoas que querem entender o que o middleware faz **sem precisar saber de programação**. Use, copie, exporte para Word, Google Docs ou Notion à vontade.

---

## 1. Em uma frase

> O middleware é um **"intermediário automático"** entre a loja virtual (Vendure) e os serviços que cuidam de pagamento e notificação. Ele recebe pedidos, valida, manda cobrar, e avisa o resto do sistema sobre o que aconteceu.

---

## 2. Uma analogia

Imagine um **caixa de restaurante**:

1. O **cliente** chega e faz o pedido → no nosso projeto, isso é a **loja virtual (Vendure)**.
2. O **caixa** olha o pedido, confere os dados, e **liga para a operadora de cartão** → no projeto, isso é o **middleware**.
3. A **operadora de cartão** aprova ou recusa o pagamento → no projeto, é o **serviço de pagamento (Payment Service)**.
4. Depois disso, o caixa **avisa a cozinha** que o pedido foi pago → no projeto, é a **fila de mensagens (RabbitMQ)**, que repassa o aviso para o **serviço de notificações**.

O middleware é **o caixa** — não vende, não cobra, não cozinha, mas **conecta todo mundo de forma confiável**.

---

## 3. Diagrama do fluxo

```
   ┌─────────────────────────┐
   │      LOJA VIRTUAL       │  Cliente coloca produto no carrinho
   │       (VENDURE)         │  e termina o pedido.
   └────────────┬────────────┘
                │
                │  "Olha, esse pedido aqui precisa ser processado:
                │   Pedido #123, valor R$ 99,90, cliente XYZ"
                ▼
   ┌─────────────────────────────────────────────────────┐
   │                  MIDDLEWARE                         │
   │  (o "caixa" — o coração do projeto)                 │
   │                                                     │
   │  PASSO 1: Confere se quem está chamando tem         │
   │           permissão (validação de "crachá" digital) │
   │                                                     │
   │  PASSO 2: Confere se os dados do pedido estão       │
   │           bem-formados (não falta nada, valores     │
   │           positivos, etc.)                          │
   │                                                     │
   │  PASSO 3: Gera um número de rastreamento único      │
   │           pra acompanhar esse pedido em todos os    │
   │           sistemas (correlation ID)                 │
   │                                                     │
   │  PASSO 4: Pede pra cobrar o cartão                  │
   │     │                                               │
   │     │  Se demorar ou der erro:                      │
   │     │     tenta de novo até 3 vezes,                │
   │     │     esperando 1s, depois 2s, depois 4s.       │
   │     │  Se nem assim funcionar:                      │
   │     │     marca como PENDENTE e segue a vida.       │
   │     ▼                                               │
   │  PASSO 5: Recebe resposta do pagamento              │
   │                                                     │
   │  PASSO 6: Avisa o resto do sistema (publica         │
   │           uma "mensagem" numa fila) sobre o que     │
   │           aconteceu — pagamento aprovado ou         │
   │           recusado.                                 │
   │                                                     │
   │  PASSO 7: Responde pra loja virtual:                │
   │           SUCESSO / FALHOU / PENDENTE               │
   └──┬────────────────────────────────────────┬─────────┘
      │                                        │
      │ "Cobre R$ 99,90 do pedido #123"        │ "Pedido #123
      ▼                                        │  foi pago"
   ┌─────────────────────┐         ┌───────────▼──────────┐
   │  SERVIÇO DE         │         │  FILA DE MENSAGENS    │
   │  PAGAMENTO          │         │  (RabbitMQ)           │
   │                     │         │                       │
   │  Aprova ou recusa   │         │  Guarda os avisos e   │
   │  o pagamento.       │         │  entrega pra quem     │
   └─────────────────────┘         │  estiver escutando.   │
                                   └───────────┬───────────┘
                                               │
                                               ▼
                                   ┌───────────────────────┐
                                   │  SERVIÇO DE           │
                                   │  NOTIFICAÇÃO          │
                                   │                       │
                                   │  Recebe o aviso e     │
                                   │  manda e-mail/SMS     │
                                   │  pro cliente.         │
                                   └───────────────────────┘
```

---

## 4. O que pode acontecer com cada pedido

```
                  Pedido entra no middleware
                            │
                            ▼
                  ┌──────────────────────┐
                  │ Pagamento foi tentado│
                  └──────────┬───────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼

   ✅ APROVADO            ❌ RECUSADO         ⚠️ PROBLEMA
   "tudo certo"           "cartão sem        "não consegui
                          saldo" / etc.       falar com a
                                              operadora"

        │                    │                    │
        ▼                    ▼                    ▼
   Avisa na fila:       Avisa na fila:        Não avisa
   "pedido pago"        "pedido falhou"       ninguém ainda
                                              (pode tentar
                                              depois)
        │                    │                    │
        ▼                    ▼                    ▼
   Responde:            Responde:             Responde:
   SUCESSO              FALHOU                PENDENTE
```

---

## 5. Quem está fazendo o quê (equipe)

O projeto é dividido em 6 pessoas. Cada uma cuida de uma parte:

```
┌──────────┬────────────────────────────────────┬─────────────┐
│ Pessoa   │ O que faz                          │ Situação    │
├──────────┼────────────────────────────────────┼─────────────┤
│ Pessoa 1 │ Monta o "caixa" do restaurante:    │ ✅ PRONTO   │
│          │ recebe pedido, valida, decide o    │  100%       │
│          │ que fazer com a resposta.          │             │
├──────────┼────────────────────────────────────┼─────────────┤
│ Pessoa 2 │ Faz a chamada para a operadora     │ ✅ PRONTO   │
│          │ de cartão. Se falhar, tenta de     │  100%       │
│          │ novo várias vezes.                 │             │
├──────────┼────────────────────────────────────┼─────────────┤
│ Pessoa 3 │ Coloca os avisos na fila e faz     │ ❌ FALTA    │
│          │ outro serviço escutar essa fila    │             │
│          │ para notificar o cliente.          │             │
├──────────┼────────────────────────────────────┼─────────────┤
│ Pessoa 4 │ Faz o sistema "contar a história": │ ❌ FALTA    │
│          │ logs organizados, números de       │             │
│          │ rastreamento, estatísticas         │             │
│          │ (quantos pedidos, quantos erros).  │             │
├──────────┼────────────────────────────────────┼─────────────┤
│ Pessoa 5 │ Cuida da segurança: só deixa       │ 🟡 QUASE    │
│          │ entrar quem tem "crachá" válido    │  (precisa   │
│          │ e permissão certa.                 │  ajustar)   │
├──────────┼────────────────────────────────────┼─────────────┤
│ Pessoa 6 │ Conecta tudo no ambiente real      │ 🟡 PARCIAL  │
│          │ (Docker, configuração, etc.) e     │             │
│          │ prepara a demonstração final.      │             │
└──────────┴────────────────────────────────────┴─────────────┘
```

**Legenda:**
- ✅ **PRONTO** — entregue e testado
- 🟡 **PARCIAL** ou **QUASE** — em andamento ou precisa de pequenos ajustes
- ❌ **FALTA** — ainda não começou

---

## 6. O que já funciona hoje

| O middleware **já consegue**… | Como sabemos |
|---|---|
| Receber um pedido da loja virtual | Testado: a loja chamou e o middleware respondeu |
| Identificar quem está chamando (crachá digital) | Implementado pela Pessoa 5 |
| Recusar pedidos com formato errado | Testado: 10 cenários diferentes de erro |
| Acompanhar cada pedido com um "número de rastreamento" único | Visto nos logs dos dois lados |
| Chamar a operadora de pagamento | Testado: pagamento aprovado, recusado, ou com problema |
| Tentar de novo se a operadora falhar (3 tentativas, esperando 1s → 2s → 4s) | Testado: confirmamos as 4 tentativas e a espera entre elas |
| Decidir se o pedido foi SUCESSO, FALHOU ou ficou PENDENTE | Testado em todos os cenários |
| Avisar que está "vivo" pra quem perguntar (health check) | Testado |

**Total de verificações automáticas que confirmam isso: 28**, todas passando.

---

## 7. O que ainda falta

| Pendência | Quem faz | Por que importa |
|---|---|---|
| Colocar avisos na fila depois de cada pagamento | Pessoa 3 | Sem isso, ninguém é notificado quando um pagamento dá certo |
| Serviço de notificação consumir a fila | Pessoa 3 | É o que vai mandar e-mail/SMS pro cliente |
| Logs organizados em formato padronizado | Pessoa 4 | Facilita encontrar o que aconteceu quando algo der errado em produção |
| Estatísticas (quantos pedidos, quantos erros, tempo médio) | Pessoa 4 | Permite monitorar a saúde do sistema |
| Ajustar a "chave de acesso" entre loja virtual e middleware | Pessoa 5 / 6 | Hoje a integração foi quebrada após a Pessoa 5 ligar a segurança — precisa gerar uma chave válida nova |
| Subir tudo com um único comando (Docker) | Pessoa 6 | Pra demonstração final e pra qualquer pessoa rodar |
| Roteiro de demonstração | Pessoa 6 | Entrega final da disciplina |

---

## 8. Resumo em 30 segundos

> Hoje, **o middleware recebe pedidos da loja, valida, e tenta cobrar o cliente com inteligência (não desiste na primeira falha)**. Tudo isso já está pronto e testado.
>
> **Ainda falta:** avisar o resto do sistema sobre os pagamentos (fila de mensagens), organizar os registros de funcionamento (logs e estatísticas), e empacotar tudo pra rodar com um único clique.
>
> **O coração do sistema está batendo.** Falta conectar os "braços" e "pernas" pra a aplicação caminhar sozinha.
