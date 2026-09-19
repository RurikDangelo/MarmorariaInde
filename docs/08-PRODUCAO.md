# 08 — Produção

## Etapas

Catálogo em `production_steps` (editável no banco):

`SEPARACAO` → `CORTE` → `ACABAMENTO` → `COLAGEM` → `POLIMENTO` → `CONFERENCIA` → `EXPEDICAO`

## Apontamento

Feito na OS, aba **Produção**, ou consultado em `/producao`.

Cada apontamento registra: etapa, responsável, equipe, peça (opcional — pode ser a OS
inteira), situação, início, término, observação e se é **retrabalho** (com motivo).

`duration_minutes` é coluna gerada: `finished_at - started_at`. Ninguém digita duração.

### Situações

`PENDENTE` · `EM_ANDAMENTO` · `PAUSADO` · `CONCLUIDO` · `RETRABALHO`

Os botões da própria etapa fazem: **Concluir**, **Pausar**, **Retomar**,
**Marcar retrabalho**.

## Retrabalho

Marcar retrabalho exige motivo. Isso alimenta:

- o indicador de retrabalho no dashboard e em **Equipe → Desempenho**
- o histórico da OS
- a conversa sobre plano de ação (módulo 14)

Retrabalho não é punição: é o dado que mostra onde o processo está falhando.

## Kanban × apontamento

São coisas diferentes e complementares:

- **Kanban** (`/os/kanban`) move a OS entre etapas — visão de fluxo.
- **Apontamento** registra quem executou, quando e quanto tempo levou — visão de execução.

Mover a OS para CORTE não cria apontamento automaticamente; quem está na máquina
registra o início. Assim o tempo medido é real.

## Página `/producao`

- carga por etapa (quantos em andamento e no total)
- lista de apontamentos com filtros por etapa e situação
- indicadores: em andamento, total, retrabalhos, duração média
