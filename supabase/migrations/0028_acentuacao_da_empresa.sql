-- =========================================================================
-- 0028 - acentuacao do nome da empresa e da cidade
--
-- A 0012 corrigiu a acentuacao dos catalogos (papeis, permissoes, etapas,
-- categorias) mas nao passou por company_settings, que tinha sido semeada em
-- ASCII pelos defaults da 0002. O nome e a cidade saem no cabecalho do
-- orcamento e da OS emitida, nas etiquetas e na linha de assinatura, entao
-- o documento que vai para o cliente estava escrito errado:
--   "MARMORARIA INDEPENDENCIA" e "Sao Jose dos Campos".
--
-- O update so troca a linha que ainda esta no valor ASCII original. Se a
-- marmoraria ja tiver digitado outro nome em Configuracoes, nada acontece.
-- =========================================================================

alter table public.company_settings
  alter column company_name set default 'MARMORARIA INDEPENDÊNCIA';

alter table public.company_settings
  alter column city set default 'São José dos Campos';

update public.company_settings
   set company_name = 'MARMORARIA INDEPENDÊNCIA'
 where company_name = 'MARMORARIA INDEPENDENCIA';

update public.company_settings
   set city = 'São José dos Campos'
 where city = 'Sao Jose dos Campos';
