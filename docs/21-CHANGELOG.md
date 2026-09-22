# 21 — Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) ·
Versionamento: [SemVer](https://semver.org/lang/pt-BR/).

## [0.2.1] — 2026-09-22

Telas mais rápidas. Detalhes em [03 — Sessão e desempenho](03-ARQUITETURA.md#sessão-e-desempenho).

### Alterado

- As funções da Vercel passam a rodar em **São Paulo (`gru1`)**, ao lado do banco. Rodavam
  em Washington (`iad1`): cada consulta cruzava o continente (~120 ms ida e volta) e cada
  tela fazia 4 delas em sequência antes de aparecer.
- O login é conferido na própria função (`getClaims`, chave pública ES256 do projeto) em
  vez de uma ida ao servidor de Auth no proxy e outra na página.
- O layout busca sessão, empresa e alertas em paralelo; OS e orçamento carregam o documento
  junto com a sessão e as demais consultas num lote só.
- O dashboard recalcula os alertas depois de responder, sem segurar a tela.

Medido localmente com um Supabase simulado (mesma latência nos dois lados): Dashboard
744 → 327 ms só com o código novo e ~100 ms com banco e funções na mesma região; as demais
telas, ~580 → ~70–100 ms.

### Notas de migração

Nenhuma migration. Depois do deploy, `x-vercel-id` deve mostrar `gru1::gru1` (ver
[16](16-DEPLOY.md)).

## [0.2.0] — 2026-09-22

OS e orçamento montados **numa tela só**, com a mesma lógica e os mesmos nomes do sistema
antigo da marmoraria. Detalhes em [22](22-MONTAGEM-DO-ORCAMENTO.md).

### Adicionado

- **Tela única** da OS (`/os/nova`, `/os/[id]`) e do orçamento (`/orcamentos/novo`,
  `/orcamentos/[id]`): cliente, dados da obra, ambientes, produtos, totais, fatura e RT sem
  trocar de página; o documento é gravado na primeira ação. Salvar = F2.
- **Montagem**: Ambiente → Produto → Materiais, Peças, Acabamentos, Serviços, Revendas,
  Insumos e Desenho ("Edição de Item", F2 Gravar / Esc Cancelar), com **m² calculado pelas
  peças** (Total M², % Perda, Total com Perda, Quantidade M², QTD M² Total) — conferido com a
  impressão do sistema antigo (4,0238 m² / R$ 4.805,68).
- **Gerar peças** a partir de Comprimento, Largura, Borda, Rodabanca e Pé.
- **Cadastro rápido** na própria tela: cliente (busca por nome/CPF/telefone), material,
  produto, acabamento, serviço, revenda, insumo e listas (ambiente, validade, previsão de
  entrega, forma de pagamento).
- **Cadastros** (`/cadastros`): produtos e serviços com código, e listas rápidas.
- Cabeçalho do antigo: Status do Orçamento, Validade → Data Validade, Previsão de Entrega,
  Vendedor, Tipo de Pagamento, Dados da Obra; Frete e Outras Despesas.
- **Fatura** (Espécie, Forma de Pagamento, parcelas) → contas a receber na aprovação ou na OS.
- **RT's** (reserva técnica) → conta a pagar.
- **Arquivos anexos** no orçamento (a OS gerada enxerga os mesmos).
- **Aprovar e gerar OS** copia a montagem inteira, confere o total e trava o orçamento.
- **Emitir OS** e impressão do orçamento com o **logo**, opções "Exibir" do antigo e via da
  oficina sem valores; **etiquetas das peças** (A4 ou térmica 100×50 mm); envio do logo em
  Configurações.
- Produção aponta a **peça**; aba Material mostra a **necessidade de m²** × reservado.
- `npm run db:test` (testes do banco em Postgres local) e `npm run db:bundle` (arquivo único
  para o SQL Editor).

### Corrigido

- Preço com centavos da peça da OS e do desconto era gravado sem o ponto decimal
  (R$ 620,50 → 6205) e quantidade 1.5 virava 15.
- Medida reaberta e salva perdia o milímetro (1,234 m → 1,230 m); "2.45" digitado com ponto
  virava 245 m.
- Mudar o desconto da OS não recalculava o total.
- Quem instala não conseguia finalizar a OS, e a produção não gravava a situação da peça
  (falhavam em silêncio por falta de `work_orders.write`).
- Orçamento aprovado podia voltar para rascunho.
- A impressão da OS saía com a barra lateral e o topo do sistema.

### Notas de migração

Migrations 0020–0026, aditivas. Em produção: `npm run db:bundle -- 0020` e colar o arquivo
no SQL Editor (uma transação). Os orçamentos e OS existentes são convertidos para a
montagem com o **mesmo total** (conferido; se divergir, nada é aplicado). As tabelas
`quote_items`/`work_order_items` ficam no banco sem uso e a tela antiga, se ainda aberta em
algum computador, é avisada para recarregar. Aplicar o SQL **antes** do deploy.

## [0.1.0] — 2026-09-18

Primeira versão operacional do ERP da Marmoraria Independência.

### Adicionado

**Fundação**
- Next.js 16 (App Router, RSC) + React 19 + TypeScript + Tailwind v4
- Design system shadcn-style sobre Radix (22 primitivos) com tokens claro/escuro
- Tema da empresa persistido no banco e aplicado sem flash (server-side)
- PWA: manifest, ícone, atalhos e comportamento standalone

**Banco (11 migrations)**
- 36 tabelas, 115 policies de RLS, 14 policies de Storage
- RBAC com 8 papéis e 32 permissões verificadas no banco (`has_perm`)
- Colunas geradas para m², valor do item, valor pendente e duração de etapa
- Triggers de numeração, totais, timeline, histórico de medição e auditoria
- Funções transacionais de estoque (reserva, consumo com retalho, perda)
- `convert_quote_to_work_order()` — aprovação de orçamento gera OS atômica
- `refresh_alerts()` — recálculo idempotente dos alertas automáticos
- Primeiro usuário criado vira ADMINISTRADOR

**Módulos**
- Ordens de serviço: lista, Kanban com arrastar e soltar, detalhe com 8 abas,
  criação, edição, impressão A4 e timeline completa
- Peças da OS com beneficiamento (acabamento, borda, saia, frontão, recortes, cuba,
  cooktop, furos) e cálculo de m² e valor no banco
- Medições com checklist de 11 itens, condições do local, revisões com diff e
  importação das medidas para as peças da OS
- Produção: apontamento por etapa com responsável, duração e retrabalho
- Estoque: chapas, retalhos e insumos; reserva, consumo com geração de sobra,
  perdas com motivo e painel de desperdício
- Instalações: agenda, checklist de 8 itens e conclusão que finaliza a OS
- Orçamentos: itens, situações e conversão em OS preservando os dados
- Financeiro: contas a pagar e receber, baixa e sincronização do recebido da OS
- Equipe: pessoas, equipes e desempenho a partir de dados reais
- Alertas: 8 regras automáticas com severidade
- Planos de ação: problema, ação, responsável, prazo e status
- Dashboard executivo com filtro de período
- Relatórios: 6 exportações CSV respeitando as permissões
- Configurações: empresa, identidade visual, etapas do fluxo e matriz de permissões
- Auditoria: log imutável de alterações sensíveis

**Acesso**
- Criação de usuários pelo próprio sistema (Equipe → Novo usuário), com senha
  provisória, definição de papel e redefinição de senha
- `service_role` isolada em `src/lib/supabase/admin.ts` com `import 'server-only'`
- O papel nunca vem do metadata do Auth: todo usuário nasce `OPERACIONAL`
  (exceto o primeiro do sistema)

**Qualidade**
- Textos de catálogo, triggers e mensagens de erro em português correto
- Helpers `format_quantity()` e `format_currency()` no banco, independentes do locale
  do servidor (5,5 · 1.250 · R$ 5.626,00)
- Paleta de gráficos validada para daltonismo e contraste em ambos os temas
- Loading, empty e error states em todas as telas; tabelas viram cartões no celular
- Seed de dados DEMO marcados com `is_demo`, removível por comando

### Notas de migração

Primeira versão — nada a migrar.
Para subir do zero: `npm run db:push` e crie o primeiro usuário no Supabase Auth.

### Pendências conhecidas

- Rate limiting adicional na borda (hoje é o padrão do Supabase Auth)
- MFA disponível no Supabase, ainda não habilitado
- Ícones PNG do PWA (hoje SVG) para melhor resultado no iOS
- Política de retenção para `audit_logs`
