# 01 — Visão geral

## O que é

ERP vertical da **MARMORARIA INDEPENDENCIA** (São José dos Campos/SP, desde 2009,
granitos e mármores nacionais e importados).

Não é um CRM nem um ERP genérico. É um sistema construído em torno de **um processo**:
transformar uma chapa de pedra em uma bancada instalada na casa do cliente — sem perder
medida, material, prazo ou dinheiro no caminho.

## O coração: a Ordem de Serviço

```
ORÇAMENTO → APROVAÇÃO → MEDIÇÃO → CONFERÊNCIA → PLANEJAMENTO → SEPARAÇÃO DE MATERIAL
→ CORTE → ACABAMENTO → CONFERÊNCIA DE QUALIDADE → EXPEDIÇÃO → INSTALAÇÃO → FINALIZAÇÃO
```

Cada etapa é uma coluna do Kanban e um registro na timeline da OS. Quem mudou, quando
mudou e de onde para onde — tudo fica gravado.

## Módulos

| Módulo | O que resolve |
|---|---|
| **Ordens de serviço** | O trabalho inteiro: peças, medidas, beneficiamento, prazo, valores, timeline |
| **Orçamentos** | Proposta que, ao ser aprovada, vira OS sem redigitar nada |
| **Medições** | Checklist de campo (esquadro, nível, cuba, hidráulica), croqui e histórico de revisões |
| **Produção** | Apontamento por etapa com responsável, início, término, duração e retrabalho |
| **Estoque** | Chapas, retalhos e insumos com reserva, consumo, sobra e perda rastreados |
| **Instalações** | Agenda das equipes e checklist de entrega ao cliente |
| **Financeiro** | Contas a receber e a pagar, vinculadas à OS |
| **Equipe** | Pessoas, equipes e desempenho medido pelos apontamentos reais |
| **Alertas** | OS atrasada, estoque baixo, pagamento vencido, medição pendente, instalação sem equipe |
| **Planos de ação** | Problema → ação → responsável → prazo, para o erro não se repetir |
| **Dashboard** | Faturamento, produção, desperdício e prazos em uma tela |
| **Relatórios** | Exportação CSV do que já é visível na tela |

## Decisões de produto que valem citar

- **Medidas em milímetros**, m² calculado pelo banco. Ninguém digita área.
- **Retalho é item de estoque.** Ao consumir uma chapa, a sobra aproveitável volta ao
  estoque com código próprio — é onde a marmoraria ganha ou perde margem.
- **Perda tem motivo obrigatório** (quebra, erro de corte, medição incorreta…). Sem motivo,
  não existe gestão de desperdício.
- **Status da OS é dado, não código.** As colunas do Kanban vêm da tabela
  `work_order_statuses` e podem mudar sem deploy.
- **Sem CRM.** Cliente existe para ter OS, endereço de instalação e pagamento.

## Onde continuar

- Arquitetura e padrões: [`03-ARQUITETURA.md`](03-ARQUITETURA.md)
- Banco e RLS: [`04-BANCO-DE-DADOS.md`](04-BANCO-DE-DADOS.md)
- Uso ponta a ponta: [`20-MANUAL-PONTA-A-PONTA.md`](20-MANUAL-PONTA-A-PONTA.md)
