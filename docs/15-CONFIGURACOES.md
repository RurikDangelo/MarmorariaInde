# 15 — Configurações

Rota `/configuracoes`. Leitura exige `settings.read`; alteração, `settings.write`
(por padrão, apenas `ADMINISTRADOR`).

## Empresa e tema

Nome, razão social, CNPJ, telefone, WhatsApp, e-mail, endereço, cidade, UF.

**Identidade visual:**

| Campo | Efeito |
|---|---|
| Cor primária | botões, links, destaques, foco, badges principais |
| Cor secundária | tom da navegação lateral |
| Cor de destaque | elementos de apoio |
| Logo (URL) | sidebar, topo do menu mobile e tela de login |
| Favicon (URL) | ícone da aba |
| Tema padrão | claro, escuro ou seguir o sistema |

As cores ficam em `company_settings` e são injetadas como variáveis CSS no layout raiz
(`BrandTheme`), renderizadas no servidor — **sem piscar** ao carregar a página.

O texto sobre a cor primária é calculado por luminância: cor clara recebe texto escuro e
vice-versa. Não há combinação ilegível possível.

> As cores dos gráficos (`--chart-*`) não mudam com a marca — ver [12](12-DASHBOARD.md).

### Logo e favicon

1. Supabase → Storage → bucket **`empresa`** (público para leitura)
2. Faça upload do arquivo
3. Copie a URL pública e cole no campo correspondente

## Etapas da OS

Lista das etapas com ordem, cor, código, quais são inicial/final e quais aparecem no
Kanban. São dados em `work_order_statuses` — mudar o fluxo da marmoraria não exige deploy.

## Permissões

Matriz completa papel × permissão, lida de `role_permissions`. É a mesma fonte que a RLS
consulta, então a tela mostra a verdade, não uma documentação paralela.

## Parâmetros operacionais

- **Validade padrão do orçamento** (dias) — preenche `valid_until` automaticamente
- **Perda esperada de material (%)** — referência de comparação no dashboard de desperdício
