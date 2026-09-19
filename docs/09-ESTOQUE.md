# 09 — Estoque

## Dois níveis

| Conceito | Tabela | O que é |
|---|---|---|
| **Material** | `materials` | o catálogo: "Granito Preto São Gabriel", preço por m², estoque mínimo |
| **Item** | `stock_items` | a coisa física: a chapa nº CH-0421, com medidas, custo, local e situação |

Um material tem muitos itens. O alerta de estoque baixo compara os itens disponíveis de
cada material com o `min_quantity` do material.

## Itens

- **CHAPA** — comprimento, largura, espessura obrigatórios; `area_m2` calculada
- **INSUMO** — quantidade + unidade (cola, disco, abrasivo, EPI)

Campos comuns: código, lote, fornecedor, localização, custo, situação, observações.

### Retalho

`is_remnant = true` e `parent_item_id` apontando para a chapa de origem.
Retalho é item de estoque de primeira classe: pode ser reservado e consumido como
qualquer chapa. É onde a marmoraria recupera margem.

### Situações

`DISPONIVEL` · `RESERVADA` · `EM_PRODUCAO` · `CONSUMIDA` · `DANIFICADA` · `DESCARTADA`

## Ciclo do material na OS

```
DISPONÍVEL ──reservar──► RESERVADA ──consumir──► CONSUMIDA
     ▲                        │                      │
     └────liberar─────────────┘                      └──► sobra vira novo item (retalho)
                              │
                              └──registrar perda──► DANIFICADA / DESCARTADA
```

Tudo isso na OS, aba **Material**:

- **Reservar material** — escolhe entre os itens disponíveis (retalhos aparecem marcados)
- **Consumir** — informa a área utilizada e, se houver, as medidas da sobra aproveitável;
  o sistema cria o retalho automaticamente com código derivado (`CH-0421-Rab12`)
- **Perda** — motivo obrigatório; opção de descarte definitivo
- **Liberar** — devolve a reserva ao estoque

Cada operação grava um `stock_movement` e um evento na timeline da OS.

## Movimentações

`ENTRADA` · `RESERVA` · `LIBERACAO` · `CONSUMO` · `SOBRA` · `PERDA` · `AJUSTE` ·
`TRANSFERENCIA` · `DESCARTE`

O histórico é a base de todo cálculo de consumo e desperdício.

## Desperdício

Aba **Desperdício** em `/estoque`:

- área consumida, área perdida, custo perdido
- percentual de desperdício = perdida ÷ (consumida + perdida)
- ranking de perdas por motivo

Motivos: quebra, erro de corte, defeito, medição incorreta, transporte, retrabalho, outro.

## Por que as funções ficam no banco

`reserve_stock_item`, `consume_stock_item` e `register_stock_loss` são funções SQL
`SECURITY DEFINER`. Elas travam a linha (`for update`), validam a situação atual, gravam o
movimento e escrevem na timeline **em uma única transação**. Duas pessoas reservando a
mesma chapa ao mesmo tempo: uma ganha, a outra recebe erro claro.
