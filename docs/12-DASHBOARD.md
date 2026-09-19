# 12 — Dashboard

Rota `/dashboard`. Filtro de período: hoje, semana, mês, 90 dias, ano.

## Blocos

### Operação
OS em aberto · OS atrasadas · finalizadas no período (com lead time médio) ·
etapas em produção (com retrabalhos).

### Financeiro (`financial.read`)
Faturamento · recebido · a receber · vencido.

### Receita e despesa por mês
Barras agrupadas, 6 meses, por data de vencimento. Duas séries, um eixo, legenda
sempre presente, tooltip no hover.

### OS por etapa
Lista proporcional (não é pizza). Nove etapas em pizza é ilegível; barra horizontal
ordenada pelo fluxo é lida em um segundo e leva direto ao filtro da lista.

### Próximas entregas
As 6 OS abertas com prazo mais próximo.

### Alertas
Os 6 alertas ativos mais recentes, com cor por severidade.

### Estoque e desperdício (`stock.read`)
Chapas disponíveis · material reservado · área consumida no período ·
percentual de desperdício (vermelho acima de 10%).

### Planos de ação
Faixa com planos em andamento e atrasados, quando houver.

## Cores dos gráficos

Os tokens `--chart-1..5` são fixos e **não** seguem a cor da marca. Foram validados para:

- faixa de luminosidade adequada ao fundo (claro e escuro têm passos próprios)
- croma mínimo (não "lavar" para cinza)
- separação mínima para daltonismo (protanopia, deuteranopia, tritanopia)
- contraste ≥ 3:1 contra a superfície

Alterar a cor primária da empresa muda botões, links e destaques — não muda a leitura
dos dados.

## Alertas automáticos

Ao abrir o dashboard, o sistema chama `refresh_alerts()`, que recalcula tudo de uma vez
e remove o que deixou de valer. Sem cron, sem alerta fantasma.
