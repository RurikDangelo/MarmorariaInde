# 11 — Equipe

## Três abas em `/equipe`

### Pessoas
Lista de perfis com papel e situação. Quem tem `users.write` troca o papel e ativa/desativa
direto no card. Novos usuários nascem no Supabase Auth (ver [05](05-USUARIOS-E-PERMISSOES.md)).

### Equipes
Equipes de `PRODUCAO`, `MEDICAO`, `INSTALACAO` ou `MISTA`, com líder, telefone e
integrantes. Uma equipe pode ser associada a:

- uma OS (`work_orders.team_id`)
- uma medição
- uma instalação
- um apontamento de produção

### Desempenho
Métricas calculadas a partir de dados reais — nada estimado:

| Métrica | Origem |
|---|---|
| OS abertas / atrasadas / concluídas | `work_orders.assigned_to` |
| Etapas concluídas | `production_records` com status `CONCLUIDO` |
| Retrabalhos | `production_records.is_rework` |
| Tempo médio | média de `duration_minutes` dos apontamentos |

Se não há apontamento, a coluna mostra "—". O sistema não inventa número.

## Por que isso importa

Em marmoraria o gargalo muda de semana para semana: ora é o corte, ora o acabamento, ora
a instalação. Medir por etapa e por pessoa mostra onde o tempo está indo antes do prazo
estourar.
