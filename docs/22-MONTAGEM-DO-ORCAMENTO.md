# 22 — Montagem do orçamento e da OS

A OS (e o orçamento) é montada **numa tela só**, como a janela "Orçamentos" do sistema
antigo: cliente, ambientes, produtos com materiais, peças e m², acabamentos, serviços,
revendas, insumos, totais, fatura e RT. Não é preciso trocar de página para nada — nem
para cadastrar um cliente, um material ou um serviço novo.

## Onde fica

| Tela | O que é |
|---|---|
| `/os/nova` | Nova OS completa. A OS é gravada na primeira ação (Salvar, ambiente ou produto) |
| `/os/[id]` | A mesma tela, já com a OS; medição, produção, material, instalação, financeiro, arquivos e timeline logo abaixo |
| `/orcamentos/novo` e `/orcamentos/[id]` | A mesma montagem para o orçamento; aprovado, vira OS com tudo |
| `/os/[id]/imprimir` | **Emitir OS** com o logo da marmoraria |
| `/orcamentos/[id]/imprimir` | Impressão do orçamento com as opções do antigo |
| `/os/[id]/etiquetas` | Etiquetas das peças (QTD de Etiquetas), A4 ou térmica 100×50 mm |
| `/cadastros` | Produtos, acabamentos, serviços, revendas, insumos e listas rápidas |

## Estrutura (nomes do sistema antigo)

```
Ambiente (1 - Cozinha)
└─ Produto (Pia e Balcão · Quant. 1 · Unid. M²)
     Comprimento · Largura · Borda · Rodabanca · Pé   ← "Gerar peças"
     ├─ Materiais   (Gran. Preto São Gabriel · Valor por M²)
     │    └─ Peças  (Peça 1: 1 Pç 2,10 × 0,60 · % Perda · Nº · Nome · QTD de Etiquetas)
     ├─ Acabamentos (Acabamento 45° · MT)
     ├─ Serviços    (Furar e Colar Cuba · UN)
     ├─ Revendas    (Cuba Inox nº 2 · PÇ)
     ├─ Insumos     (Cola · custo, não compõe o total)
     └─ Desenho     (foto do croqui ou PDF do projeto)
```

| Antigo | Aqui |
|---|---|
| Nº Orçamento / Status do Orçamento | número automático (`ORC-2026-0001`) / Status do Orçamento |
| Data Emissão, Validade, Data Validade | iguais; Validade é lista rápida (7, 10, 15, 30 dias…) |
| Previsão de Entrega (lista + data) | igual; aceita dias corridos ou úteis |
| Vendedor | usuário do sistema |
| Tipo de Pagamento (À Vista / A Prazo) | igual |
| Dados da Obra | igual |
| Ambientes (+) / Cadastro de Ambientes | igual (Item, Nome do Ambiente, Descrição) |
| Produtos — Incluir | "Incluir produto" |
| Edição de Item (F2 Gravar / ESC Cancelar) | igual, com as mesmas abas e atalhos |
| Total deste Ambiente | igual |
| Total dos Produtos, Frete, Outras Despesas, Desconto (R$), Total do Orçamento | iguais |
| Fatura: Espécie, Forma de Pagamento, Título/Vencimento/Valor | iguais |
| Total de Materiais · Arquivos Anexos · RT's | abas abaixo dos totais |
| MT (metro linear) | unidade `ML` no banco, exibida como **MT** |

## Cálculo (o banco é a fonte da verdade)

| Onde | Regra |
|---|---|
| Peça | **Total M²** = Quantidade × Comprimento × Largura (4 casas) |
| Peça | **Total com Perda M²** = Total M² × (1 + % Perda) (4 casas) |
| Material | **Quantidade M²** = soma do Total com Perda das peças dele |
| Material | **QTD M² Total** = Quantidade M² × Quant. do produto |
| Material | **Valor Total** = QTD M² Total × Valor por M² (2 casas) |
| Acabamento/Serviço/Revenda/Insumo | QTD Total = Quant. × Quant. do produto; Valor = QTD Total × unitário |
| Produto | **Total Geral do Item** = Materiais + Acabamentos + Serviços + Revendas (**Insumos não entram**) |
| Documento | **Total** = Total dos Produtos + Frete + Outras Despesas − Desconto |

A composição vale para **uma unidade** do produto; a Quant. multiplica (24 soleiras iguais =
uma soleira montada × 24).

Conferido com a impressão do sistema antigo: 11 peças da "Pia e Balcão" = **4,0238 m²**,
× R$ 600 = **R$ 2.414,28**; com acabamentos (R$ 1.175,40), serviços (R$ 926,00) e cuba
(R$ 290,00) o item fecha em **R$ 4.805,68**. Esse caso está em `supabase/tests/montagem.test.sql`
e no seed DEMO.

- A tela mostra a prévia enquanto você digita (mesmas fórmulas, em inteiros, em
  `src/features/composition/pricing.ts`), mas o que fica gravado é calculado pelo banco
  (colunas geradas nas peças e recálculo por trigger).
- **% Perda** padrão das peças novas: Configurações → Perda esperada de material.
- **Valor por M²** e preço dos serviços vêm do cadastro (**cadeado fechado**). Abrir o
  cadeado permite digitar um preço só para aquele documento.
- **Gerar peças**: com Comprimento e Largura, cria Tampo (C×L), Saia (C×Borda),
  Rodabanca (C×Rodabanca) e Pé (Pé×L) no primeiro material do produto.

## Cadastro rápido (sem sair da tela)

- **Cliente**: busca por nome, CPF/CNPJ ou telefone; se não achar, "Cadastrar ‘texto
  digitado’" abre o cadastro já com o nome e volta com o cliente escolhido.
- **Material, produto, acabamento, serviço, revenda, insumo**: busca por código ou
  descrição (sem acento) e "+ Cadastrar" (exige `stock.write`).
- **Nome do ambiente, validade, previsão de entrega, forma de pagamento**: listas rápidas;
  quem monta orçamento/OS pode incluir itens na lista.
- O ambiente pode ser criado na própria edição do produto (grava junto).

## Teclado

| Tecla | Onde | Faz |
|---|---|---|
| **F2** | tela | Salvar os dados (cliente, datas, frete, desconto…) |
| **F2** | Edição de Item | Gravar o produto inteiro |
| **Esc** | Edição de Item | Cancelar (pede confirmação se mudou algo) |
| **Enter** | QTD de Etiquetas da última peça | lança a próxima peça |

## Aprovação do orçamento

"Aprovar e gerar OS" (`quotes.approve`) copia **tudo** para a nova OS — ambientes,
produtos, materiais, peças, composição, RT e anexos — e confere que o total da OS saiu
igual ao do orçamento. Opcionalmente lança as parcelas da Fatura em contas a receber
(`financial.write`). O orçamento aprovado fica **travado**: nada nele muda depois, e ele não
volta para rascunho; as mudanças (ex.: depois da medição) são feitas na OS.

## Gravação e segurança

- As tabelas `environments`, `line_items`, `line_item_materials`, `line_item_pieces` e
  `line_item_components` são **só leitura pela API**. Gravar é sempre por funções
  `SECURITY DEFINER` que checam permissão: `save_environment`, `delete_environment`,
  `save_line_item` (produto inteiro numa transação), `delete_line_item`,
  `duplicate_line_item`, `set_piece_status`, `import_measurement`,
  `save_quote_installments`, `save_technical_reserve`, `approve_quote`,
  `generate_work_order_receivables`, `launch_technical_reserve`, `finish_installation`.
- `save_line_item` recusa linhas de outro produto, usa `version` contra edição simultânea
  ("alterado por outra pessoa") e relê o preço do cadastro quando o cadeado está fechado.
- Orçamento → `quotes.*`; OS → `work_orders.*`. Quem só aponta produção muda a situação da
  peça (`production.write`) sem poder editar a OS.

## Documentos antigos

Orçamentos e OS criados antes (itens "planos") foram convertidos pela migration 0026 com
o **mesmo total**: cada item virou ambiente + produto + material + peça (cobrança por m²)
ou produto + serviço (metro linear/unidade). Acabamento, borda, cuba, furos e observações
foram para Especificações da peça. As tabelas antigas continuam no banco, sem uso.
