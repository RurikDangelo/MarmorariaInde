# Marmoraria Independência — ERP

Sistema de gestão da **Marmoraria Independência** (São José dos Campos/SP).
ERP vertical construído em torno da **Ordem de Serviço**: do orçamento à instalação,
com medição, produção, estoque de chapas e financeiro no mesmo fluxo.

```
ORÇAMENTO → APROVAÇÃO → MEDIÇÃO → CONFERÊNCIA → PLANEJAMENTO → SEPARAÇÃO
→ CORTE → ACABAMENTO → CONFERÊNCIA → EXPEDIÇÃO → INSTALAÇÃO → FINALIZAÇÃO
```

## Produção

**https://marmoraria-independencia.vercel.app** — deploy automático a cada push em `main`.

## Stack

Next.js 16 (App Router, RSC) · React 19 · TypeScript · Tailwind CSS v4 ·
Radix (shadcn-style) · Supabase (PostgreSQL 17, Auth, Storage, RLS) · Vercel

## Começar

```bash
npm install
cp .env.local.example .env.local   # preencha as variáveis
npm run db:push                    # cria o schema no Supabase
npm run db:seed                    # dados DEMO (opcional, só em desenvolvimento)
npm run dev
```

O primeiro usuário criado no Supabase Auth vira **ADMINISTRADOR** automaticamente.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | desenvolvimento |
| `npm run build` | build de produção |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:push` | aplica `supabase/migrations/*.sql` |
| `npm run db:seed` | popula dados DEMO (`-- --limpar` remove) |

## Documentação

Tudo em [`docs/`](docs/):

| | |
|---|---|
| [01 Visão geral](docs/01-VISAO-GERAL.md) | [12 Dashboard](docs/12-DASHBOARD.md) |
| [02 Instalação](docs/02-INSTALACAO.md) | [13 Alertas](docs/13-ALERTAS.md) |
| [03 Arquitetura](docs/03-ARQUITETURA.md) | [14 Planos de ação](docs/14-PLANOS-DE-ACAO.md) |
| [04 Banco de dados](docs/04-BANCO-DE-DADOS.md) | [15 Configurações](docs/15-CONFIGURACOES.md) |
| [05 Usuários e permissões](docs/05-USUARIOS-E-PERMISSOES.md) | [16 Deploy](docs/16-DEPLOY.md) |
| [06 Ordens de serviço](docs/06-ORDENS-DE-SERVICO.md) | [17 Segurança](docs/17-SEGURANCA.md) |
| [07 Medições](docs/07-MEDICOES.md) | [18 Manual do usuário](docs/18-MANUAL-USUARIO.md) |
| [08 Produção](docs/08-PRODUCAO.md) | [19 Manual do administrador](docs/19-MANUAL-ADMINISTRADOR.md) |
| [09 Estoque](docs/09-ESTOQUE.md) | [**20 Manual ponta a ponta**](docs/20-MANUAL-PONTA-A-PONTA.md) |
| [10 Financeiro](docs/10-FINANCEIRO.md) | [21 Changelog](docs/21-CHANGELOG.md) |
| [11 Equipe](docs/11-EQUIPE.md) | [CLAUDE.md](CLAUDE.md) — contexto para agentes |

## Segurança em uma linha

RLS ligada em todas as tabelas; toda policy chama `has_perm('<recurso>.<acao>')`.
Permissão é verificada no banco, não só na tela. Detalhes em
[17-SEGURANCA.md](docs/17-SEGURANCA.md).
