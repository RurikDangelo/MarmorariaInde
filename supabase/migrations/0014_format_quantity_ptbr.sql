-- =========================================================================
-- 0014 - format_quantity deterministico em pt-BR
--
-- 'G' e 'D' no to_char usam o locale do servidor (aqui em_US), entao 1250
-- saia como "1,250" e 5.5 como "5.5". Usando os literais ',' e '.' no
-- template o resultado nao depende do locale; depois basta inverter os dois
-- separadores para o padrao brasileiro.
-- =========================================================================

create or replace function public.format_quantity(p_value numeric)
returns text
language sql
immutable
as $fn$
  select translate(
           case
             when p_value is null then '0'
             when p_value = trunc(p_value) then trim(to_char(p_value, 'FM999,999,999,990'))
             else trim(to_char(round(p_value, 3), 'FM999,999,999,990.999'))
           end,
           ',.',   -- separadores do template (milhar, decimal)
           '.,'    -- separadores do pt-BR
         );
$fn$;

comment on function public.format_quantity is
  'Quantidade em pt-BR: 5 -> "5", 5.5 -> "5,5", 1250 -> "1.250", 1250.75 -> "1.250,75".';
