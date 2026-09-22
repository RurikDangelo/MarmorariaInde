# 06 — Ordens de serviço

A OS é o centro do sistema. Tudo — medição, material, produção, instalação, dinheiro —
pendura nela. Desde a 0.2.0 ela é montada **numa tela só**, como o sistema antigo
(detalhes da montagem em [22](22-MONTAGEM-DO-ORCAMENTO.md)).

## Telas

| Rota | O que é |
|---|---|
| `/os` | Lista com filtros (etapa, prioridade, situação, responsável) e busca |
| `/os/kanban` | Quadro por etapa com arrastar e soltar |
| `/os/nova` | **Nova OS completa**: cliente, dados da obra, ambientes, produtos, totais, fatura e RT |
| `/os/nova?cliente=<id>` | Idem, já com o cliente (botão "Nova OS" da ficha do cliente) |
| `/os/[id]` | A mesma tela com a OS gravada + andamento (abas abaixo) |
| `/os/[id]/editar` | Redireciona para `/os/[id]` (a edição é na própria tela) |
| `/os/[id]/imprimir` | **Emitir OS** com o logo, opções de exibição e via da oficina (sem valores) |
| `/os/[id]/etiquetas` | Etiquetas das peças para a produção |

## A tela da OS

De cima para baixo:

1. **Barra fixa**: situação da gravação, **Salvar (F2)**, **Etiquetas** e **Emitir OS**
   (salva antes, se houver mudança).
2. **Dados da OS**: cliente (busca + cadastro na hora), vendedor, prioridade, serviço,
   previsão de entrega (lista) → prazo, tipo de pagamento, responsável e equipe.
   **Dados da Obra** (endereço de execução, contato, agenda de medição/instalação) e
   **Observações** ficam em blocos recolhíveis.
3. **Ambientes e produtos**: ambientes à esquerda, grade de produtos à direita,
   "Incluir produto" abre a Edição de Item.
4. **Totais**: Total dos Produtos, Frete, Outras Despesas, Desconto, Total da OS.
5. **Total de Materiais · Fatura · RT's**.
6. **Andamento**: Medição · Produção · Material · Instalação · Financeiro · Arquivos · Timeline
   (cada aba só aparece com a permissão de leitura do módulo).

Na Nova OS nada existe no banco até a primeira ação; escolher o cliente é obrigatório
antes de incluir ambiente ou produto. Depois da criação a tela continua a mesma, agora no
endereço da OS.

## Campos da OS

Número (automático `OS-2026-0001`), cliente, orçamento de origem, vendedor, responsável,
equipe, prioridade, etapa, prazo, agendamento de medição e de instalação, endereço de
execução, dados da obra, tipo/espécie/forma de pagamento, total dos produtos, frete,
outras despesas, desconto, total, recebido, pendente, observações (saem na OS) e internas.

- `products_total` vem da montagem (soma dos produtos) — mantido pelo banco.
- `total_value` = `products_total + freight + surcharge − discount` — trigger; mudar frete ou
  desconto recalcula na hora.
- `received_value` vem dos títulos de receita pagos vinculados à OS; `pending_value` é gerada.

## Mudança de etapa

Três caminhos, todos passam pela mesma regra:

1. Botão **Mudar etapa** no topo da OS
2. Diálogo com observação opcional
3. Arrastar o card no Kanban

Exige `work_orders.status`. Toda mudança grava um evento na timeline com o nome de quem
mexeu. Ao entrar em etapa terminal (`FINALIZADA`), `finished_at` é preenchido. OS
finalizada ou cancelada não aceita mudança na montagem (reabra mudando a etapa).

## Produção por peça

O apontamento de produção escolhe a **peça** da montagem ("Cozinha · Pia e Balcão · Peça 3
— Saia (0,94 × 0,06)"). A situação da peça (`PENDENTE`, `EM_PRODUCAO`, `PRONTO`,
`INSTALADO`, `RETRABALHO`) é gravada por `set_piece_status`, que exige `production.write`
(não precisa poder editar a OS). Concluir a instalação (`finish_installation`) finaliza a OS
e marca as peças como instaladas.

## Medição → produtos

"Gerar peças da OS" na medição aprovada (`import_measurement`) cria um produto com a peça
medida para cada medida, no ambiente de mesmo nome (cria o ambiente se não existir). O
material é escolhido depois na montagem.

## Material

A aba Material mostra a **necessidade da montagem** (m² com perda por material) ao lado
das chapas reservadas e do que falta separar.

## Timeline

Alimentada automaticamente: criação, status, prioridade, responsável, prazo, valor,
produtos e ambientes (`ITEM`), medição, produção, material, instalação, pagamento, RT e
anexos. Observações manuais na aba Timeline. É **imutável**.

## Cancelamento

Exige motivo. A OS sai do Kanban, mantém histórico e lançamentos, e recebe
`cancelled_at` + `cancel_reason`.

## Emissão

`/os/[id]/imprimir`: logo e dados da marmoraria, cliente, dados da obra, cada ambiente com
produtos, materiais, peças (com medidas), acabamentos, serviços e revendas, total de
material, totais, parcelas lançadas, vendedor, agenda, observações e assinaturas.
"Valores" desligado gera a via da oficina. Imprimir ou salvar em PDF pelo navegador.
