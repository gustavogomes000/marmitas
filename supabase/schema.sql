-- =============================================================================
-- D'a Márcia Marmitaria — Schema Completo do Supabase
-- =============================================================================
-- Como usar:
-- 1. Abra o painel do Supabase -> SQL Editor -> New Query
-- 2. Cole TODO este script e clique em "Run" (ou Ctrl+Enter)
-- 3. Pronto! Tabelas, políticas RLS, categorias, entregadores e acessos criados.
--
-- Logins padrão criados (Senha inicial: 123456):
--   • marcia@marmitaria.com   (Admin)
--   • cozinha@marmitaria.com  (Cozinha)
--   • entrega@marmitaria.com  (Entregador)
-- =============================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ 1. perfis
create table if not exists public.perfis (
  id            text primary key,
  nome          text not null default '',
  email         text not null default '',
  papel         text not null default 'cozinha' check (papel in ('adm', 'cozinha', 'entregador')),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  ultimo_acesso timestamptz,
  auth_user_id  uuid references auth.users (id) on delete set null
);
create index if not exists perfis_email_idx on public.perfis (lower(email));

-- -------------------------------------------------------------- 2. categorias
create table if not exists public.categorias (
  id     text primary key,
  nome   text not null,
  fluxo  text not null check (fluxo in ('entrada', 'saida')),
  emoji  text not null default '🧾',
  cor    text not null default 'text-saida',
  ordem  integer not null default 0
);

-- ----------------------------------------------------------- 3. dias de venda
create table if not exists public.dias_venda (
  id            text primary key,
  data          date not null unique,
  preco_marmita numeric(10, 2) not null default 0,
  obs           text not null default '',
  prato         text not null default '',
  fechado_em    date,
  criado_em     timestamptz not null default now()
);

alter table public.dias_venda add column if not exists fechado_em date;
alter table public.dias_venda add column if not exists prato text not null default '';

-- ------------------------------------------------------------ 4. entregadores
create table if not exists public.entregadores (
  id       text primary key,
  nome     text not null,
  telefone text not null default '',
  ativo    boolean not null default true
);

-- ------------------------------------------------------------------ 5. vendas
create table if not exists public.vendas (
  id           text primary key,
  dia_id       text not null references public.dias_venda (id) on delete cascade,
  cliente      text not null default '',
  qtd          integer not null default 1 check (qtd > 0),
  pg           boolean not null default false,
  paga         boolean not null default false,
  entregue_por text references public.entregadores (id) on delete set null,
  status       text not null default 'pendente'
               check (status in ('pendente', 'preparada', 'entregue', 'cancelada')),
  obs          text not null default '',
  ordem        integer not null default 0,
  valor_unit   numeric(10, 2),
  acrescimo    numeric(10, 2) not null default 0,
  valor_pago   numeric(10, 2)
);
create index if not exists vendas_dia_idx on public.vendas (dia_id, ordem);

alter table public.vendas add column if not exists valor_unit numeric(10, 2);
alter table public.vendas add column if not exists acrescimo numeric(10, 2) not null default 0;
alter table public.vendas add column if not exists valor_pago numeric(10, 2);
alter table public.vendas
  drop constraint if exists vendas_entregue_por_fkey,
  add constraint vendas_entregue_por_fkey
  foreign key (entregue_por) references public.entregadores (id) on delete set null;

-- --------------------------------------------------- 6. caixa (movimentações)
create table if not exists public.movimentacoes (
  id           text primary key,
  data         date not null,
  descricao    text not null default '',
  valor        numeric(10, 2) not null default 0,
  fluxo        text not null check (fluxo in ('entrada', 'saida')),
  categoria_id text references public.categorias (id) on delete set null,
  forma        text not null default 'outro'
               check (forma in ('pix', 'dinheiro', 'cartao', 'outro')),
  obs          text not null default '',
  criado_em    timestamptz not null default now()
);
create index if not exists movimentacoes_data_idx on public.movimentacoes (data desc);

-- ---------------------------------------------------------- 7. contas a pagar
create table if not exists public.contas (
  id           text primary key,
  descricao    text not null default '',
  fornecedor   text not null default '',
  valor        numeric(10, 2) not null default 0,
  vencimento   date not null,
  categoria_id text references public.categorias (id) on delete set null,
  forma        text not null default 'outro'
               check (forma in ('pix', 'dinheiro', 'cartao', 'outro')),
  paga         boolean not null default false,
  pago_em      date,
  grupo        text,
  parcela      integer,
  parcelas     integer,
  obs          text not null default '',
  criado_em    timestamptz not null default now()
);
create index if not exists contas_vencimento_idx on public.contas (vencimento, paga);

-- ------------------------------------------------- 8. Permissões e Políticas RLS
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;

alter table public.perfis         enable row level security;
alter table public.categorias     enable row level security;
alter table public.dias_venda     enable row level security;
alter table public.vendas         enable row level security;
alter table public.entregadores   enable row level security;
alter table public.movimentacoes  enable row level security;
alter table public.contas         enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['perfis', 'categorias', 'dias_venda', 'vendas', 'entregadores', 'movimentacoes', 'contas']
  loop
    execute format('drop policy if exists "%s_escrita" on public.%I', t, t);
    execute format('drop policy if exists "%s_acesso_equipe" on public.%I', t, t);
    execute format(
      'create policy "%s_acesso_equipe" on public.%I for all to anon, authenticated using (true) with check (true)',
      t, t
    );
  end loop;
end
$$;

-- --------------------------------------------------------- 9. Dados Iniciais
insert into public.categorias (id, nome, fluxo, emoji, cor, ordem) values
  ('cat_venda',     'Venda de marmita', 'entrada', '🍱', 'text-entregue', 1),
  ('cat_outro_e',   'Outro',            'entrada', '💰', 'text-entregue', 2),
  ('cat_mercado',   'Mercado',          'saida',   '🛒', 'text-saida',    1),
  ('cat_gas',       'Gás',              'saida',   '🔥', 'text-saida',    2),
  ('cat_carne',     'Carne',            'saida',   '🥩', 'text-saida',    3),
  ('cat_arroz',     'Arroz e feijão',   'saida',   '🍚', 'text-saida',    4),
  ('cat_embalagem', 'Embalagem',        'saida',   '📦', 'text-saida',    5),
  ('cat_energia',   'Energia',          'saida',   '⚡', 'text-saida',    6),
  ('cat_agua',      'Água',             'saida',   '💧', 'text-saida',    7),
  ('cat_gasolina',  'Gasolina',         'saida',   '⛽', 'text-saida',    8),
  ('cat_limpeza',   'Limpeza',          'saida',   '🧽', 'text-saida',    9),
  ('cat_outro_s',   'Outro',            'saida',   '🧾', 'text-saida',   10)
on conflict (id) do nothing;

insert into public.perfis (id, nome, email, papel, ativo) values
  ('usr_marcia',  'Márcia',            'marcia@marmitaria.com',   'adm',        true),
  ('usr_cozinha', 'Ajuda da cozinha',  'cozinha@marmitaria.com',  'cozinha',    true),
  ('usr_entrega', 'Rota de entrega',   'entrega@marmitaria.com',  'entregador', true)
on conflict (id) do update set
  nome  = excluded.nome,
  email = excluded.email,
  papel = excluded.papel,
  ativo = true;

-- --------------------------------------- 10. Usuários Auth padrão (senha: 123456)
do $$
declare
  u record;
  novo_id uuid;
begin
  for u in
    select * from (values
      ('usr_marcia',  'marcia@marmitaria.com',  'Márcia',           'adm'),
      ('usr_cozinha', 'cozinha@marmitaria.com', 'Ajuda da cozinha', 'cozinha'),
      ('usr_entrega', 'entrega@marmitaria.com', 'Rota de entrega',  'entregador')
    ) as t(perfil_id, email, nome, papel)
  loop
    select id into novo_id from auth.users where lower(email) = lower(u.email) limit 1;
    if novo_id is null then
      novo_id := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
      ) values (
        '00000000-0000-0000-0000-000000000000',
        novo_id,
        'authenticated',
        'authenticated',
        u.email,
        crypt('123456', gen_salt('bf')),
        now(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('nome', u.nome, 'papel', u.papel),
        now(),
        now(),
        '', '', '', ''
      );

      insert into auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(),
        novo_id,
        u.email,
        jsonb_build_object('sub', novo_id::text, 'email', u.email, 'email_verified', true),
        'email',
        now(),
        now(),
        now()
      );
    end if;

    update public.perfis set auth_user_id = novo_id where id = u.perfil_id;
  end loop;
exception
  when others then
    -- Caso a versão do GoTrue tenha restrições extras em auth.users,
    -- o login via tabela public.perfis garante o acesso imediato.
    null;
end
$$;

-- Atualiza o cache da API REST do Supabase imediatamente
notify pgrst, 'reload schema';
