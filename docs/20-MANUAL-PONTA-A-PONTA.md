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

### 1.5 Cadastrar materiais, produtos e serviços

**Estoque → Novo material**: código 155, "Gran. Preto São Gabriel", tipo Granito, cor Preto,
nacional, 20 mm, R$ 600,00/m², estoque mínimo 3.

**Cadastros**: os produtos que você vende (Pia e Balcão, Bancada, Soleira), acabamentos por
metro linear (Acabamento 45° R$ 120/MT), serviços (Furar e Colar Cuba R$ 150/UN),
revendas (Cuba Inox nº 2 R$ 290/PÇ) e insumos (cola — custo). Em **Listas**, os nomes de
ambiente, validades, previsões de entrega e formas de pagamento (`0/30/60`).

> Não precisa cadastrar tudo antes: qualquer um desses pode ser criado na hora, dentro da
> tela da OS.

**Estoque → Entrada de estoque**: chapa `CH-0421`, 3,20 m × 1,90 m, 20 mm,
custo R$ 3.400,00, Pátio de chapas. Repita para cada chapa que chegou.

**Configurações → Enviar logo**: o logo sai no topo da OS emitida e do orçamento.

---

## Parte 2 — Do contato à OS (tudo numa tela)

### 2.1 Abrir a OS (ou o orçamento)

**Ordens de serviço → Nova OS** (ou **Orçamentos → Novo orçamento**; a tela é a mesma).

**Cliente**: digite "Ana" — se ela não existir, **Cadastrar "Ana Paula Ribeiro"** abre o
cadastro já com o nome; salve e ela volta escolhida, com o endereço da obra preenchido.

Preencha vendedor, **Previsão de Entrega** (20 dias úteis → a data sai sozinha) e o
**Tipo de Pagamento**. **Salvar (F2)** grava — ou já siga para os produtos: a OS é criada
na primeira ação.

### 2.2 Ambientes e produtos (a montagem)

1. **Ambientes → +** → "Cozinha" (ou crie direto no produto).
2. **Incluir produto** → **Produto**: Pia e Balcão · Quant. 1 · Unid. M².
3. **Materiais**: busque "155" ou "preto sao" → Gran. Preto São Gabriel (R$ 600/m², cadeado
   fechado = preço do cadastro).
4. **Peças**: lance cada peça (Quantidade, Comprimento, Largura, % Perda, Número, Nome,
   QTD de Etiquetas) — ou preencha Comprimento/Largura/Borda/Rodabanca/Pé no topo e use
   **Gerar peças**. O **Total M²** e o **Total com Perda** aparecem na hora.
5. **Acabamentos** (Acabamento 45° 9,12 MT), **Serviços** (Furar e Colar Cuba, Furo
   Cooktop, Instalação 4,84 MT), **Revendas** (Cuba Inox), **Insumos** (cola — só custo).
6. O rodapé mostra Total de Materiais, Total M², Acabamentos, Serviços, Revendas, Insumos e o
   **Total Geral do Item**. **F2** grava; **Esc** cancela.

Exemplo real (da impressão do sistema antigo): 11 peças = 4,0238 m² → R$ 2.414,28 de
material; item R$ 4.805,68.

### 2.3 Totais, fatura e emissão

- **Frete, Outras Despesas, Desconto** → Total da OS (Salvar).
- **Fatura**: Espécie + Forma de Pagamento → **Gerar parcelas** → ajuste → lance no
  contas a receber (OS) ou salve a fatura (orçamento).
- **RT's**: arquiteto que indicou, % ou valor fixo (não vai para o cliente).
- **Emitir OS**: abre a folha com o logo; imprima ou salve em PDF. Desligue "Valores" para a
  via da oficina. **Etiquetas** imprime uma etiqueta por peça.

### 2.4 Errou? Cancelar, reativar ou excluir

**Cancelar OS** (com motivo) tira a OS do Kanban e guarda tudo — é o caminho normal quando
o cliente desiste. Depois, **Reativar OS** devolve a OS para a etapa em que ela estava.

**Excluir** é para o que nunca deveria existir: OS ou orçamento duplicado, teste, engano.
Some do sistema com peças, anexos e títulos não pagos; o sistema pede o número digitado e
guarda na auditoria quem excluiu e por quê. OS com pagamento já baixado não é excluída, e
orçamento que virou OS também não.

### 2.5 Orçamento aprovado → OS

No orçamento, **Aprovar e gerar OS** → prazo → (opcional) lançar as parcelas → a OS nasce
com **toda** a montagem, RT e anexos, e o orçamento fica travado como foi vendido.

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
Se a medida real ficou diferente do orçamento, ajuste as peças na montagem da OS — ou use
**Gerar peças da OS** para criar produtos a partir do que foi medido (no ambiente de mesmo
nome) e escolha o material na montagem.

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
Aba **Produção → Iniciar etapa**: `Separação`, responsável e, se quiser, a **peça**
("Cozinha · Pia e Balcão · Peça 3 — Saia"). Ao terminar, **Concluir**.
Depois `Corte`, mesmo caminho. A duração é calculada sozinha. As etiquetas das peças
(**Etiquetas** no topo da OS) identificam cada peça na bancada.

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

As parcelas da **Fatura** (aprovação do orçamento ou "Lançar no contas a receber" na OS)
já estão no financeiro, vinculadas à OS. Recebeu a entrada? **Financeiro → Dar baixa**.

Lançamento avulso: **Financeiro → Novo lançamento**: Receita, "Entrada 50% — bancada Ana Paula",
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
Nova OS (ou orçamento): cliente + ambientes + produtos/peças/m² + fatura → Emitir OS
   (orçamento: aprovar → OS com toda a montagem e as parcelas no financeiro)
   → Medição → checklist → aprovar → ajustar peças
   → Reservar chapa → Corte → Consumir (gera retalho) → Acabamento → Conferência
   → Expedição → Instalação → checklist → Finalizar OS
   → Financeiro: entrada + saldo → OS quitada
```

Cada seta acima deixou um registro na timeline da OS, com data, hora e nome de quem fez.
