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

Quem tem `alerts.write` pode dispensar um alerta (`dismissed_at`).

**A dispensa vale até o fim do dia.** No dia seguinte, se a condição ainda existir, o
alerta reaparece — o problema não sumiu porque alguém fechou o aviso. O recálculo limpa
o `dismissed_at` quando ele é de um dia anterior (fuso `America/Sao_Paulo`).

Duas alternativas foram descartadas:

- *Voltar no próximo recálculo*: o recálculo roda a cada abertura do dashboard, então a
  dispensa duraria segundos e o botão perderia o sentido.
- *Voltar só quando a severidade sobe*: uma OS que fica atrasada por semanas nunca mais
  avisaria.

> Até a migration `0027` a dispensa era **definitiva** — um problema real ficava em
> silêncio para sempre depois de um clique. Este documento descrevia o comportamento
> pretendido, não o implementado.

O painel do dashboard também não trata "sem alerta ativo" como "sem problema": se os
próprios números da tela apontam pendências (OS atrasada, título vencido, plano
atrasado) e não há alerta ativo, ele informa quantas estão sem aviso em vez de dizer que
está tudo em dia.

## Onde aparecem

- Contador no topo da tela (badge vermelho ao lado do tema)
- Card no dashboard
- Central em `/alertas`
