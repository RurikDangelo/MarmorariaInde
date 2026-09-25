# 12 — Dashboard

Rota `/dashboard`. Filtro de período: hoje, semana, mês, 90 dias, ano.

## Blocos

### Operação
OS em aberto · OS atrasadas · finalizadas no período (com lead time médio) ·
etapas em produção (com retrabalhos).

### Financeiro (`financial.read`)
Faturamento · recebido · a receber · vencido.

### Receita e despesa por mês
Barras agrupadas, 6 meses, por data de vencimento. Duas séries, um eixo.
A legenda mostra o **total de cada série no período** — identifica e informa ao mesmo
tempo. No hover, o mês apontado fica em 100% e os demais recuam para 28%: o olho vai
direto para o período que está sendo lido. O tooltip traz mês, receita, despesa e o
**saldo** (só quando existem os dois lados; com um lado só, o saldo repetiria a linha
de cima).

### OS por etapa
Barra horizontal proporcional (não é pizza). Nove etapas em pizza é ilegível; a barra
ordenada pelo fluxo é lida em um segundo e cada linha leva direto à lista já filtrada.
Mostra contagem e percentual do total em aberto.

Não usa Recharts de propósito: a linha é um link, e isso vale mais que interação de
gráfico. Também não manda JavaScript para o cliente — a animação é CSS e o valor está
sempre visível, então não há informação escondida atrás de tooltip.

### Próximas entregas
As 6 OS abertas com prazo mais próximo. O prazo é dito em texto
(*"atrasada 3 dias"*, *"entrega amanhã"*) além da cor.

### Alertas
Os 6 alertas ativos, críticos primeiro. Severidade tem ícone e rótulo além da cor.

### Estoque e desperdício (`stock.read`)
Chapas disponíveis · material reservado · área consumida no período ·
percentual de desperdício (vermelho acima de 10%).

### Planos de ação
Faixa com planos em andamento e atrasados, quando houver.

## Cores dos gráficos

Os tokens `--chart-1..5` **não** seguem a cor escolhida pela empresa em Configurações:
são escolhidos e validados separadamente. Alterar a cor da marca muda botões, links e
destaques — não muda a leitura dos dados.

Os valores atuais partiram do verde da marca (`#05ad46`), ajustado até passar em todos
os critérios:

| Série | Claro | Escuro |
|---|---|---|
| 1 — Receita | `#05913A` | `#18A94E` |
| 2 — Despesa | `#2563EB` | `#3B82F6` |

Cada par foi conferido em faixa de luminosidade, croma mínimo, separação para daltonismo
(protanopia, deuteranopia, tritanopia), piso de visão normal e contraste ≥ 3:1 contra a
superfície — nos dois temas, com passos próprios para cada um.

**Por que despesa é azul e não vermelho.** Duas razões:

1. Verde × vermelho é o par que desaparece na deuteranopia: ΔE 6,5 contra os ~29 do
   verde × azul. Reprovaria sem uma segunda pista de identificação.
2. Vermelho no sistema significa *estado ruim* (vencido, atrasado). Despesa é normal —
   pintá-la de vermelho todo mês faria o alarme perder o sentido.

O verde da marca puro (`#05ad46`) tem contraste 2,89:1 sobre o fundo claro, abaixo do
mínimo de 3:1. Por isso a série usa uma versão escurecida dele no tema claro.

## Linguagem de movimento

Uma escala só, declarada em `globals.css` e usada pelo sistema inteiro:

| Token | Duração | Onde |
|---|---|---|
| `--motion-hover` | 150 ms | realce de cartão, linha, barra |
| `--motion-micro` | 200 ms | tooltip, ícone |
| `--motion-enter` | 320 ms | entrada de bloco (escalonada em 45 ms) |
| `--motion-content` | 260 ms | troca de conteúdo |
| `--motion-chart` | 700 ms | barras entrando |

Easing `--ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`): sai rápido e chega macio — lê-se
como "assentou", não como "quicou".

**Quando anima.** Entrada de bloco e barras acontecem na montagem. Trocar de período
**não** reanima os cartões: o React reconcilia o DOM existente e animação CSS só dispara
quando o elemento nasce. O que muda nessa hora são os números, que contam do valor
antigo para o novo — a transição comunica exatamente o que aconteceu.

**Acessibilidade.** `prefers-reduced-motion: reduce` zera as animações no CSS
(regra global) e o hook `usePrefersReducedMotion` desliga as que são controladas em
JavaScript — Recharts e o count-up. Nada de informação se perde: tudo aparece no estado
final, sem o trajeto até ele.

## Troca de período sem remontar a tela

`useUrlFilters` (em `components/shared/filters.tsx`) navega dentro de
`startTransition`. Sem isso o Next trata a mudança como urgente, descarta a tela e exibe
o `loading.tsx` — o dashboard inteiro desmonta e remonta a cada troca de período.

Dentro da transição: a tela atual continua no lugar, o seletor mostra um spinner
enquanto o servidor recalcula, e quando o dado novo chega os números transicionam e o
gráfico reanima (a assinatura dos dados muda e o `key` do gráfico com ela).

O `loading.tsx` do dashboard só aparece na **primeira** abertura da tela, e reproduz a
mesma grade do conteúdo real — quatro cartões por faixa, gráfico 2/3 + lista 1/3 — para
que nada salte de lugar quando os dados chegam.

## Alertas automáticos

Ao abrir o dashboard, o sistema chama `refresh_alerts()` dentro de `after()`: recalcula
tudo de uma vez, sem segurar a resposta da página. Sem cron, sem alerta fantasma.

## Componentes

```
features/dashboard/
  queries.ts                      leitura e agregação (um Promise.all)
  components/
    cashflow-chart.tsx            Recharts, client
    stage-breakdown.tsx           CSS puro, server
    upcoming-deliveries.tsx       server
    alerts-panel.tsx              server
components/shared/
  metric-card.tsx                 KPI (server) + AnimatedNumber (client)
  animated-number.tsx             count-up
lib/hooks/
  use-prefers-reduced-motion.ts   useSyncExternalStore
```

Só dois componentes do dashboard mandam JavaScript para o cliente: o gráfico de barras e
o número que conta. O resto é HTML e CSS.
