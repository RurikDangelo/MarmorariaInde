# 10 — Financeiro

Controle operacional de caixa, não um ERP contábil. O objetivo é responder três perguntas:
quanto entra, quanto sai e quanto a OS ainda deve.

## Estrutura

| Tabela | Uso |
|---|---|
| `financial_accounts` | caixa, banco, cartão |
| `financial_categories` | categorias de receita e despesa (vêm com um conjunto padrão) |
| `financial_transactions` | os títulos a receber e a pagar |

## Lançamento

Descrição, tipo (`RECEITA`/`DESPESA`), categoria, conta, **OS vinculada**, cliente, valor,
vencimento, pagamento, situação, forma de pagamento, parcela e observações.

Situações: `PENDENTE` · `PAGO` · `ATRASADO` · `CANCELADO`.

## Vínculo com a OS

Receita `PAGO` vinculada a uma OS dispara `tg_sync_work_order_received`, que:

1. recalcula `work_orders.received_value` somando os títulos pagos
2. atualiza `pending_value` (coluna gerada)
3. grava "Pagamento recebido" na timeline da OS

Por isso o valor recebido da OS **nunca** é digitado à mão.

## Parcelas vindas da OS e do orçamento

- **Fatura do orçamento** (Espécie, Forma de Pagamento `0/30/60`, Título/Vencimento/Valor):
  na aprovação, com "Lançar as parcelas em contas a receber" marcado, cada parcela vira um
  título `RECEITA` / `PENDENTE` da OS (categoria "Venda de serviço"). Exige `financial.write`
  e que a soma das parcelas bata com o total.
- **Fatura da OS** (OS sem orçamento, ou aprovada sem lançar): o mesmo gerador lança o que
  falta receber (`generate_work_order_receivables`).
- **RT** (reserva técnica do arquiteto): na OS, "Lançar" cria um título `DESPESA` na
  categoria "Reserva técnica (RT)" com o vencimento escolhido. A RT com percentual acompanha
  o total do documento até ser lançada.

## Tela `/financeiro`

Indicadores: a receber, a pagar, saldo realizado (recebido − pago) e vencido.
Filtros por tipo, situação e busca. Botão **Dar baixa** marca o título como pago na data
de hoje.

## Fluxo de caixa

O gráfico do dashboard mostra receita × despesa dos últimos 6 meses, por data de
vencimento. Duas séries, um eixo só, cores validadas para daltonismo.

## O que ficou de fora (de propósito)

Emissão de NF-e, conciliação bancária, DRE e centro de custo. Se um dia forem necessários,
a modelagem já separa conta, categoria e transação — dá para crescer sem refazer.
