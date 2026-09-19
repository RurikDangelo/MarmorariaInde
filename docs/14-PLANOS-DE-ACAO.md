# 14 — Planos de ação

Um alerta diz que algo deu errado. O plano de ação diz o que será feito para não repetir.

## Campos

título · problema · ação · responsável · OS relacionada (opcional) · prioridade ·
prazo · status · observações

Status: `ABERTO` · `EM_ANDAMENTO` · `CONCLUIDO` · `CANCELADO`.
Ao concluir, `completed_at` é carimbado.

## Tela `/planos-de-acao`

- Indicadores: em andamento, atrasados, concluídos
- Mudança de status direto na lista (quem tem `action_plans.write`)
- Badge "atrasado" quando o prazo venceu e o plano não está concluído

## Integração

- Plano atrasado gera alerta (`PLANO_ATRASADO`)
- O dashboard mostra uma faixa quando há planos em andamento
- Vincular à OS liga a causa ao caso concreto (ex.: a OS onde a chapa quebrou)

## Uso esperado

1. Retrabalho ou perda registrada na produção/estoque
2. Reunião rápida: qual foi o problema de verdade?
3. Plano com ação concreta, responsável e prazo
4. Acompanhamento semanal pela tela
