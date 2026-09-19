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
