# 20 — Manual ponta a ponta

Do primeiro login até a OS finalizada, com um caso real: **bancada de cozinha em granito
preto para a cliente Ana Paula**.

---

## Parte 1 — Preparar o sistema (uma vez só)

### 1.1 Criar o administrador

Supabase → **Authentication → Users → Add user**
E-mail, senha, marque *Auto Confirm User*.
O primeiro usuário do sistema vira **ADMINISTRADOR** automaticamente.

### 1.2 Entrar

Abra o endereço do sistema → e-mail e senha → você cai no **Dashboard**.

### 1.3 Configurar a empresa

**Configurações → Empresa e tema**: nome, CNPJ, telefone, WhatsApp, endereço.
Escolha a cor primária, envie o logo (Storage → bucket `empresa` → copie a URL pública).
Salvar. O sistema inteiro muda de cor na hora.

### 1.4 Cadastrar a equipe

Crie os usuários no Supabase e, em **Equipe → Pessoas**, defina o papel de cada um:
medidor → `MEDICAO`, oficina → `PRODUCAO`, instalador → `INSTALACAO`,
administrativo → `FINANCEIRO`, pátio → `ESTOQUE`.

Em **Equipe → Equipes**, crie "Equipe Corte A", "Instalação 1", "Medição Campo" e marque
os integrantes.

### 1.5 Cadastrar materiais e chapas

**Estoque → Novo material**: "Granito Preto São Gabriel", tipo Granito, cor Preto,
nacional, 20 mm, R$ 620,00/m², estoque mínimo 3.

**Estoque → Entrada de estoque**: chapa `CH-0421`, 3,20 m × 1,90 m, 20 mm,
custo R$ 3.400,00, Pátio de chapas. Repita para cada chapa que chegou.

---

## Parte 2 — Do contato à OS

### 2.1 Cadastrar a cliente

**Clientes → Novo cliente**: Ana Paula Ribeiro, CPF, telefone/WhatsApp, endereço completo
(é para lá que a equipe vai medir e instalar).

### 2.2 Orçamento (opcional, mas recomendado)

**Orçamentos → Novo orçamento** → cliente Ana Paula → **Adicionar item**:

- Bancada da pia · Cozinha · Granito Preto · 2,40 × 0,60 · 1 un · R$ 620/m² · Polido · Boleada
- Frontão · Cozinha · 2,40 × 0,10 · 1 un

O total sai calculado. Marque **como enviado** quando mandar para a cliente.

### 2.3 Aprovação → OS

Cliente aprovou? **Aprovar e gerar OS** → informe o prazo → o sistema:

- muda o orçamento para APROVADO
- cria a **OS-2026-0001** com o cliente e o endereço
- copia os itens como peças da OS
- registra tudo na timeline

Você já cai na OS criada.

> Sem orçamento? **Ordens de serviço → Nova OS** e adicione as peças direto.

---

## Parte 3 — Medição

### 3.1 Agendar

Na OS, aba **Medição** → **Registrar medição**:
responsável (o medidor), situação **Agendada**, data e hora, endereço (já vem do cliente).

### 3.2 No local — pelo celular

O medidor abre a OS no celular e edita a medição:

- **Obstáculos:** "armário aéreo instalado, atenção ao recorte"
- **Hidráulica:** "ponto de água à esquerda da cuba"
- **Checklist:** marca medidas, esquadro, nível, parede, cuba, torneira, tomadas, fotos,
  cliente acompanhou

Em **Medida**, lança cada ponto:
`Bancada da pia · Cozinha · 2,40 × 0,60 · 1` e `Frontão · 2,40 × 0,10 · 1`.

Fotos vão pela aba **Arquivos**, etapa *Medição*.

### 3.3 Conferir e aprovar

De volta ao escritório: **Aprovar medição**.
Se a medida real ficou diferente do orçamento, use **Gerar peças da OS** para criar as
peças a partir do que foi medido e ajuste preço e acabamento na aba Resumo.

Cada alteração da medição vira uma **revisão** com o "de → para" gravado.

---

## Parte 4 — Planejamento e material

### 4.1 Mover a OS

**Mudar etapa → Aguardando material** (ou arraste no Kanban).

### 4.2 Reservar a chapa

Aba **Material → Reservar material**: escolha `CH-0421` (retalhos aparecem marcados —
prefira aproveitá-los quando couber a peça).

A chapa fica **RESERVADA**, some da lista de disponíveis e a timeline registra
"Material reservado".

---

## Parte 5 — Produção

### 5.1 Separação e corte

Mova a OS para **Corte**.
Aba **Produção → Iniciar etapa**: `Separação`, responsável. Ao terminar, **Concluir**.
Depois `Corte`, mesmo caminho. A duração é calculada sozinha.

### 5.2 Baixar o material

Aba **Material → Consumir** na chapa reservada:

- área utilizada: `1,56` m²
- sobra aproveitável: `1,20 × 0,70`

O sistema baixa a chapa e **cria o retalho** `CH-0421-Rab12` como item disponível.
É assim que a sobra deixa de virar entulho.

### 5.3 Se algo quebrar

Aba **Material → Perda** → motivo `Quebra` → descreva. Entra no custo real e no
dashboard de desperdício. Vale abrir um **plano de ação** se virar padrão.

### 5.4 Acabamento e conferência

Mova para **Acabamento** e aponte as etapas `Acabamento`, `Colagem`, `Polimento`.
Precisou refazer? Marque **retrabalho** com o motivo.
Depois **Conferência** e **Expedição**.

---

## Parte 6 — Instalação

### 6.1 Agendar

Mova para **Instalação**. Aba **Instalação → Agendar instalação**: equipe, data, endereço.

> Instalação sem equipe a menos de 3 dias gera alerta automático.

### 6.2 Na obra

A equipe abre a OS no celular e marca o checklist: material conferido, peças conferidas,
medidas conferidas, local preparado, instalação concluída, acabamento conferido,
fotos finais, cliente acompanhou.

Fotos de antes e depois pela aba **Arquivos**.

### 6.3 Concluir

**Concluir instalação e finalizar OS**:

- a instalação vira CONCLUÍDA e aprovada
- a OS vai para **FINALIZADA** com `finished_at`
- as peças ficam como INSTALADO

---

## Parte 7 — Dinheiro

### 7.1 Entrada

**Financeiro → Novo lançamento**: Receita, "Entrada 50% — bancada Ana Paula",
categoria *Entrada / sinal*, **vincule a OS-2026-0001**, valor, vencimento, situação Pago.

O **valor recebido da OS se atualiza sozinho** e a timeline registra o pagamento.

### 7.2 Saldo

Outro lançamento para o saldo, com vencimento na entrega. Ao receber, **Dar baixa**.
A OS fica com pendente R$ 0,00.

Título vencido e não pago → alerta **crítico**.

---

## Parte 8 — Acompanhar

| Pergunta | Onde |
|---|---|
| O que atrasou? | Dashboard → OS atrasadas |
| Onde travou? | Kanban |
| Quanto estou perdendo de material? | Estoque → Desperdício |
| Quem está produzindo quanto? | Equipe → Desempenho |
| Quanto tenho a receber? | Financeiro |
| O que precisa de atenção agora? | Alertas |
| O que decidimos para não repetir? | Planos de ação |

---

## Resumo do fluxo

```
Cliente → Orçamento → (aprovar) → OS
   → Medição → checklist → aprovar → gerar peças
   → Reservar chapa → Corte → Consumir (gera retalho) → Acabamento → Conferência
   → Expedição → Instalação → checklist → Finalizar OS
   → Financeiro: entrada + saldo → OS quitada
```

Cada seta acima deixou um registro na timeline da OS, com data, hora e nome de quem fez.
