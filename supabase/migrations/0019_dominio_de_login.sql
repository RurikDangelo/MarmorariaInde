-- =========================================================================
-- 0019 - dominio usado quando o acesso e criado por nome de usuario
--
-- A marmoraria nao quer depender de e-mail real para dar acesso ao pedreiro,
-- ao instalador ou ao medidor. O Auth do Supabase exige um e-mail, entao o
-- sistema monta um a partir do nome de usuario:
--
--     "joao.silva"  ->  joao.silva@<login_domain>
--
-- O dominio fica configuravel porque o GoTrue valida o dominio no cadastro e
-- o que passa depende da configuracao do projeto. Se um dominio for recusado,
-- basta trocar em Configuracoes — sem deploy.
-- =========================================================================

alter table public.company_settings
  add column if not exists login_domain text not null default 'marmoraria.app';

comment on column public.company_settings.login_domain is
  'Dominio anexado ao nome de usuario quando o acesso e criado sem e-mail real. '
  'Esses enderecos nao recebem e-mail: a senha e entregue pelo administrador.';

alter table public.company_settings
  drop constraint if exists company_settings_login_domain_check;

alter table public.company_settings
  add constraint company_settings_login_domain_check
  check (login_domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$');
