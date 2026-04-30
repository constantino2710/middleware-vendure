# Declaração de Uso de IA / LLM

> **Atenção:** este documento atende ao requisito do enunciado (slide 8) — a omissão dessa seção no relatório técnico implica em **−3,0 pontos** na nota final.

---

## 1. Ferramentas e modelos utilizados

| Ferramenta | Modelo | Onde foi acessada |
|------------|--------|-------------------|
| Claude Code (Anthropic) | Claude Opus 4.7 (1M context) | CLI integrado ao VS Code |

> Adicionar aqui outras ferramentas se a equipe usar (ChatGPT, Gemini, Copilot, etc.).

---

## 2. Onde a IA foi utilizada

### 2.1 Estruturação inicial do projeto
- **O quê:** definição da estrutura de pastas seguindo a Seção 4 do contexto-geral (`/middleware`, `/services`, `/docs`, `docker-compose.yml`).
- **Como:** geração de esqueleto com `Dockerfile`, `package.json`, `tsconfig.json`, `nest-cli.json` e arquivos `.ts` com stubs comentados (sem lógica implementada).
- **Validação:** estrutura conferida manualmente contra o enunciado e adaptada ao stack TypeScript + NestJS.

### 2.2 Configuração de infraestrutura
- **O quê:** redação do `docker-compose.yml` com Postgres, RabbitMQ, healthchecks e dependências entre serviços.
- **Validação:** revisado pela equipe; ajustes feitos para variáveis de ambiente e portas.

### 2.3 Documentação
- **O quê:** reformatação do `contexto-geral.md` (de texto plano para markdown estruturado).
- **O quê:** estrutura inicial deste relatório técnico e do README.

### 2.4 Definição de stack
- **O quê:** discussão de trade-offs entre Express puro vs NestJS, escolha de bibliotecas (`@golevelup/nestjs-rabbitmq`, `nestjs-pino`, `p-retry`, `prom-client`, `passport-jwt`).
- **Decisão final:** equipe escolheu NestJS + bibliotecas idiomáticas Nest.

---

## 3. Onde a IA NÃO foi utilizada (responsabilidade da equipe)

- Lógica de negócio e implementação dos métodos dos serviços (`order.service.ts`, `payment.client.ts`, `publisher.service.ts`, etc.).
- Estratégia de retry/timeout/fallback (decisão arquitetural da Pessoa 2).
- Implementação real do guard JWT e roles (Pessoa 5).
- Configuração final de ambiente e segredos.
- Testes manuais e de integração.
- Apresentação e pitch.

---

## 4. Prompts principais utilizados

> Lista resumida dos prompts mais relevantes (não literais, mas representativos do que foi pedido).

1. **"Criar esqueleto inicial do projeto seguindo a especificação contexto-geral, com TypeScript + NestJS, em 3 serviços (middleware, payment-service, notification-service) + Docker Compose."**
   - Saída: árvore de pastas, `package.json` com deps, `Dockerfile` multi-stage, stubs `.ts` comentados.

2. **"Comparar a estrutura atual com os requisitos do PDF do projeto e apontar lacunas."**
   - Saída: checklist de cobertura (síncrono, assíncrono, resiliência, observabilidade, segurança, tolerância a falhas) e alertas (commit history, declaração de IA, diagrama visual).

3. **"Reformatar contexto-geral.doc para markdown válido preservando todo o conteúdo."**
   - Saída: arquivo `contexto-geral.md` com headers, code fences e listas.

4. **"Como configurar Vendure com Postgres no docker-compose e expor evento de criação de pedido para um middleware externo via OrderStateTransitionEvent."**
   - Saída: orientação de plugin Vendure + variáveis de ambiente + boot order.

> A equipe deve **completar esta lista** com os prompts adicionais usados durante o desenvolvimento da lógica de cada serviço.

---

## 5. Validação e responsabilidade

- Todo código gerado por IA foi **revisado** pelos membros da equipe antes de ser commitado.
- Os stubs gerados servem como **scaffolding**; a implementação efetiva (lógica de negócio, decisões de retry, configuração de filas, guards) é responsabilidade dos integrantes.
- A equipe assume **plena responsabilidade técnica** pelo conteúdo entregue, conforme exigido no slide 8.

---

## 6. Como manter este documento atualizado

Cada vez que um membro usar IA para gerar código, documentação ou diagrama relevante:

1. Adicionar uma linha em **Seção 2** (onde foi usado).
2. Anexar o prompt em **Seção 4**.
3. Mencionar a ferramenta em **Seção 1** se for diferente das já listadas.

Commitar este arquivo junto com o código gerado.
