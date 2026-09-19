# 07 — Medições

Medida errada é prejuízo direto: chapa cortada não volta atrás. Por isso a medição tem
checklist, condições do local e histórico de revisões.

## Onde fica

- Dentro da OS, aba **Medição** (registro e edição)
- `/medicoes` — agenda geral, com filtro por situação

## Registro

| Bloco | Campos |
|---|---|
| Agenda | responsável, equipe, agendada para, medida em, situação |
| Local | CEP, endereço, número, complemento, bairro, cidade, UF |
| Condições | obstáculos, hidráulica, elétrica, parede/nível, observações gerais |
| Checklist | 11 itens de conferência |
| Medidas | lista de pontos medidos com comprimento, largura, espessura e quantidade |

### Checklist (seção 15 do escopo)

conferiu medidas · esquadro · nível · parede · cuba · cooktop · torneira · tomadas ·
hidráulica · fotos registradas · cliente acompanhou

## Situações

`PENDENTE` → `AGENDADA` → `REALIZADA` → `APROVADA` (ou `REPROVADA`)

Aprovar a medição preenche `approved_at` e libera a OS para planejamento e produção.

## Histórico de revisões

Toda alteração incrementa `revision` e grava em `work_order_measurement_history`:

- o número da revisão
- o **diff em JSON** (campo: de → para)
- um snapshot completo do registro
- quem alterou e quando

Além disso, um evento entra na timeline da OS. É a resposta para
"quem mudou essa medida depois que a chapa já estava marcada?".

## Medição → peças da OS

O botão **Gerar peças da OS** copia as medidas conferidas para `work_order_items`,
preservando descrição, ambiente, medidas e quantidade. Preço e acabamento são ajustados
depois, na aba Resumo.

É o momento em que o trabalho de campo vira ordem de corte — sem redigitar medida.

## Fotos e croqui

Fotos vão para o bucket `medicoes` (privado, acesso por `measurements.read`).
Anexos gerais da OS, incluindo croquis, vão para `os-arquivos` pela aba Arquivos.
