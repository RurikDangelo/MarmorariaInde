# 06 — Ordens de serviço

A OS é o centro do sistema. Tudo — medição, material, produção, instalação, dinheiro —
pendura nela.

## Telas

| Rota | O que é |
|---|---|
| `/os` | Lista com filtros (etapa, prioridade, situação, responsável) e busca |
| `/os/kanban` | Quadro por etapa com arrastar e soltar |
| `/os/nova` | Criação |
| `/os/[id]` | Detalhe com abas |
| `/os/[id]/editar` | Edição dos dados da OS |
| `/os/[id]/imprimir` | Folha A4 para a oficina e para o cliente |

## Abas do detalhe

**Resumo** — cliente, endereço de execução, responsável, agendamentos, observações e a
lista de peças (adicionar, editar, remover).
**Medição** · **Produção** · **Material** · **Instalação** · **Financeiro** · **Arquivos** ·
**Timeline**.

Cada aba só aparece se o usuário tiver a permissão de leitura do módulo.

## Campos da OS

Número (automático `OS-2026-0001`), cliente, orçamento de origem, responsável, equipe,
prioridade, etapa, prazo, agendamento de medição e de instalação, endereço de execução,
valor total, recebido, pendente, desconto, observações (visíveis) e observações internas.

`total_value` vem da soma das peças menos o desconto — calculado por trigger.
`received_value` vem dos títulos de receita pagos e vinculados à OS.
`pending_value` é coluna gerada.

## Peças (itens da OS)

Cada peça registra o que a oficina precisa saber para cortar:

- descrição, ambiente, material, cor, espessura
- comprimento × largura × quantidade → **m² calculado pelo banco**
- cobrança por m², metro linear ou unidade + preço unitário → **valor calculado pelo banco**
- acabamento, borda, saia, frontão
- recortes, cuba (tipo e quantidade), cooktop, furos de torneira, de tomada e extras
- observações e situação de produção

> As medidas são digitadas **em metros** (`2,45`) e gravadas em milímetros.

## Mudança de etapa

Três caminhos, todos passam pela mesma regra:

1. Botão **Avançar para <próxima etapa>** no topo do detalhe
2. Diálogo **Mudar etapa** (com observação opcional)
3. Arrastar o card no Kanban

Exige a permissão `work_orders.status`. Toda mudança grava um evento na timeline com o
nome de quem mexeu. Ao entrar em etapa terminal (`FINALIZADA`), `finished_at` é preenchido.

## Timeline

Alimentada automaticamente por triggers: criação, status, prioridade, responsável, prazo,
valor, medição, produção, material (reserva/consumo/perda), instalação, pagamento e anexos.
Observações manuais podem ser adicionadas na aba Timeline.

A timeline é **imutável**: não há policy de `update`/`delete` em `work_order_history`.

## Cancelamento

Exige motivo. A OS sai do Kanban, mantém histórico e lançamentos, e recebe
`cancelled_at` + `cancel_reason`.

## Impressão

`/os/[id]/imprimir` gera uma folha limpa com cabeçalho da empresa, cliente, endereço,
tabela de peças (com recortes e furos), resumo financeiro e linhas de assinatura.
