# 13 — Alertas

## Como são gerados

A função `public.refresh_alerts()` recalcula todos os alertas automáticos em uma
transação e sincroniza a tabela `alerts`: insere os novos, atualiza os existentes e
**apaga os que não se aplicam mais**.

É chamada ao abrir o dashboard e a central de alertas, e pelo botão **Recalcular**.
Não depende de cron nem de job externo.

## Regras

| Alerta | Condição | Severidade |
|---|---|---|
| OS atrasada | prazo vencido, OS não finalizada nem cancelada | CRÍTICO |
| OS vencendo | prazo nos próximos 3 dias | ATENÇÃO |
| OS parada | sem atualização há mais de 7 dias, fora de etapa final | ATENÇÃO |
| Estoque abaixo do mínimo | itens disponíveis < `materials.min_quantity` | ATENÇÃO |
| Pagamento vencido | título pendente com vencimento no passado | CRÍTICO |
| Medição pendente | medição pendente/agendada sem data ou para as próximas 48h | ATENÇÃO |
| Instalação sem equipe | instalação nos próximos 3 dias sem equipe definida | ATENÇÃO |
| Plano de ação atrasado | prazo vencido e status aberto/em andamento | ATENÇÃO |

## Severidades

`INFO` · `ATENCAO` · `CRITICO` — cada uma com cor e contagem própria na tela.

## Dispensar

Quem tem `alerts.write` pode dispensar um alerta (`dismissed_at`). Alertas automáticos
dispensados voltam se a condição continuar valendo após o próximo recálculo — o que é o
comportamento correto: o problema não sumiu porque alguém fechou o aviso.

## Onde aparecem

- Contador no topo da tela (badge vermelho ao lado do tema)
- Card no dashboard
- Central em `/alertas`
