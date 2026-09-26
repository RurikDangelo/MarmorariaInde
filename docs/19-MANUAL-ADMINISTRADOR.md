# 19 — Manual do administrador

## Primeiro dia

1. **Criar usuários** — no sistema, **Equipe → Novo usuário**: nome, e-mail, papel e senha
   provisória. Entregue a senha para a pessoa; ela troca no primeiro acesso.
2. **Ajustar papéis depois** — **Equipe → Pessoas**, seletor no card
3. **Configurar a empresa** — **Configurações**: dados, cores, logo, tema
4. **Cadastrar materiais** — **Estoque → Novo material**: granitos, mármores, insumos.
   Defina o **estoque mínimo** de cada um para receber alerta
5. **Dar entrada nas chapas** — **Estoque → Entrada de estoque**, com código, medidas e custo
6. **Criar equipes** — **Equipe → Nova equipe** (corte, medição, instalação)
7. **Cadastrar clientes** e abrir a primeira OS

## Rotina semanal sugerida

| Quando | O quê |
|---|---|
| Toda manhã | Dashboard: OS atrasadas, alertas críticos, entregas da semana |
| Toda manhã | Kanban: o que travou em alguma etapa |
| Semanal | Estoque → Desperdício: percentual e motivos |
| Semanal | Equipe → Desempenho: retrabalhos e tempo médio |
| Semanal | Planos de ação: o que está atrasado |
| Mensal | Financeiro: recebido × a receber × vencido |
| Mensal | Relatórios: exportar OS, produção e desperdício |

## Gerenciar acesso

- **Criar usuário:** Equipe → Novo usuário
- **Trocar papel:** Equipe → Pessoas → seletor no card
- **Resetar senha:** Equipe → Pessoas → botão Senha (define nova ou envia link por e-mail)
- **Desativar alguém:** botão *Desativar* — o acesso cai na hora, o histórico permanece
- **Ver quem pode o quê:** Configurações → Permissões

Ninguém consegue mudar o próprio papel, nem por requisição direta na API.

## Auditoria

**Auditoria** mostra quem alterou o quê em OS, usuários, financeiro, estoque,
configurações e permissões. É só leitura — nem o administrador apaga o log.

## Manutenção

### Remover dados de demonstração
```bash
npm run db:seed -- --limpar
```

### Zerar o sistema para entregar a um cliente

Apaga todo o movimento e os cadastros alimentados no uso — OS, orçamentos, montagem,
clientes, produtos, materiais, estoque, financeiro, alertas, auditoria e arquivos —
e devolve a numeração para `OS-<ano>-0001`.

**Fica de pé:** os logins (`auth.users` e `profiles`), papéis, permissões, etapas da OS,
etapas de produção, tipos de material, categorias e contas financeiras, locais de
estoque, listas rápidas e as configurações da empresa. Ou seja, tudo que o sistema
instala sozinho pelas migrations — nada do que foi digitado na tela.

```bash
npm run db:reset                  # lista o que sairia e o que fica; não apaga
npm run db:reset -- --confirmar   # apaga
```

Sem `--confirmar` é só um ensaio. Com `--confirmar`, antes de apagar o script grava
um JSON de tudo em `backups/` (fora do Git, porque tem dado de cliente).

Duas travas: se existir tabela que o script não classifica como "fica" ou "sai", ele
recusa a rodar — tabela nova não escapa do reset em silêncio; e se o `cascade` do
`truncate` fosse alcançar alguma tabela da lista de "fica", ele também para.

Para preservar o catálogo de produtos e materiais, acrescente `--manter-cadastros`.

> Os arquivos do Storage só somem se `SUPABASE_SERVICE_ROLE_KEY` estiver no
> `.env.local`. Sem ela o banco é limpo do mesmo jeito e o script avisa quantos
> arquivos ficaram para trás.

### Aplicar atualizações do banco
```bash
npm run db:push
```

### Backup manual
```bash
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner > backup-$(date +%F).sql
```

### Ajustar as etapas do fluxo
As etapas vivem em `work_order_statuses`. Para renomear, reordenar ou tirar do Kanban,
basta um `UPDATE` — nenhum deploy é necessário.

## Quando algo dá errado

| Sintoma | Onde olhar |
|---|---|
| Usuário não vê um módulo | Equipe → Pessoas (papel) e Configurações → Permissões |
| Valor da OS não bate | Aba Resumo: soma das peças menos desconto; confira também o desconto |
| Recebido da OS não atualiza | O título precisa ser RECEITA, estar PAGO e vinculado à OS |
| Chapa não aparece para reservar | Só itens com situação DISPONÍVEL aparecem |
| Link de senha aponta para localhost | Supabase → Authentication → URL Configuration |
