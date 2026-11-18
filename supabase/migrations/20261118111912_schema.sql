-- =============================================================================
-- Tesouro EPA — Fase 1: esquema base, funções auxiliares e RLS
-- =============================================================================
-- Princípios:
--  * As equipas (sessões anónimas) só leem os seus próprios dados e NUNCA
--    escrevem diretamente em tabelas: tudo passa por funções RPC validadas.
--  * A resposta certa do quiz vive no schema `private`, que não é exposto pela
--    API do Supabase e não tem permissões para anon/authenticated.
--  * Só professores (tabela staff) validam, pontuam e gerem equipas.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.staff_role as enum ('teacher', 'admin');
create type public.submission_status as enum ('pending', 'approved', 'rejected');
create type public.gps_status as enum ('ok', 'denied', 'unavailable');
create type public.adjustment_type as enum ('teamwork', 'presentation', 'safety');

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
create table public.events (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 1 and 120),
  event_date        date not null,
  starts_at         timestamptz not null,
  deadline_at       timestamptz not null,
  active            boolean not null default false,
  base_name         text not null default 'Escola Profissional de Aveiro',
  base_lat          double precision not null default 40.6468,
  base_lng          double precision not null default -8.6455,
  coordinator_name  text check (char_length(coordinator_name) <= 80),
  coordinator_phone text check (char_length(coordinator_phone) <= 30),
  created_at        timestamptz not null default now(),
  constraint events_deadline_after_start check (deadline_at > starts_at)
);
comment on table public.events is 'Edições da atividade. Só pode haver um evento ativo de cada vez.';
create unique index events_single_active on public.events ((true)) where active;

create table public.checkpoints (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  seq         smallint not null check (seq between 1 and 7),
  name        text not null check (char_length(name) between 1 and 120),
  theme       text not null default '',
  description text not null default '',
  challenge   text not null,
  text_prompt text,  -- pergunta para a resposta escrita; null = desafio sem frase
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  radius_m    integer not null default 75 check (radius_m between 10 and 1000),
  unique (event_id, seq)
);
comment on column public.checkpoints.seq is 'Ordem do posto no percurso (1–7).';

create table public.quiz_questions (
  checkpoint_id uuid primary key references public.checkpoints (id) on delete cascade,
  question      text not null,
  options       jsonb not null,
  constraint quiz_options_abcd check (
    jsonb_typeof(options) = 'object' and options ?& array['A', 'B', 'C', 'D']
  )
);
comment on table public.quiz_questions is 'Pergunta e opções A–D. A resposta certa está em private.quiz_keys.';

create table private.quiz_keys (
  checkpoint_id  uuid primary key references public.quiz_questions (checkpoint_id) on delete cascade,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D'))
);
comment on table private.quiz_keys is 'Respostas certas. Inacessível ao cliente; só lida por funções security definer.';

create table public.teams (
  id                 uuid primary key default gen_random_uuid(),
  event_id           uuid not null references public.events (id) on delete cascade,
  name               text not null check (char_length(name) between 1 and 60),
  class_name         text not null default '' check (char_length(class_name) <= 40),
  code               text not null unique check (code ~ '^EPA-[A-Z0-9]{4}$'),
  start_seq          smallint not null default 1 check (start_seq between 1 and 7),
  deadline_at        timestamptz,  -- se vazio, vale a hora limite do evento
  arrived_at         timestamptz,
  arrival_lat        double precision,
  arrival_lng        double precision,
  arrival_distance_m real,
  created_at         timestamptz not null default now(),
  unique (event_id, name)
);
create index teams_event_idx on public.teams (event_id);

create table public.team_members (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  team_id   uuid not null references public.teams (id) on delete cascade,
  joined_at timestamptz not null default now()
);
comment on table public.team_members is 'Liga cada sessão (telemóvel) a uma equipa. Sem dados pessoais.';
create index team_members_team_idx on public.team_members (team_id);

create table public.submissions (
  id               uuid primary key,  -- gerado no cliente: reenvios da fila offline são idempotentes
  team_id          uuid not null references public.teams (id) on delete cascade,
  checkpoint_id    uuid not null references public.checkpoints (id) on delete cascade,
  photo_path       text not null unique,
  challenge_text   text check (char_length(challenge_text) <= 600),
  lat              double precision,
  lng              double precision,
  accuracy_m       real,
  gps_status       public.gps_status not null,
  distance_m       real,
  out_of_area      boolean not null default false,
  taken_at         timestamptz,  -- hora no telemóvel (pode ser anterior ao envio, se ficou em fila)
  created_at       timestamptz not null default now(),  -- hora do servidor
  status           public.submission_status not null default 'pending',
  points_photo     smallint check (points_photo between 0 and 5),
  points_relevance smallint check (points_relevance between 0 and 5),
  points_text      smallint check (points_text between 0 and 5),
  challenge_points smallint generated always as (
    coalesce(points_photo, 0) + coalesce(points_relevance, 0) + coalesce(points_text, 0)
  ) stored,
  teacher_comment  text check (char_length(teacher_comment) <= 500),
  reviewed_by      uuid references auth.users (id) on delete set null,
  reviewed_at      timestamptz,
  submitted_by     uuid references auth.users (id) on delete set null
);
-- Uma submissão ativa (pendente ou validada) por equipa e posto; após rejeição pode reenviar.
create unique index submissions_one_active on public.submissions (team_id, checkpoint_id)
  where status <> 'rejected';
create index submissions_team_idx on public.submissions (team_id);
create index submissions_checkpoint_idx on public.submissions (checkpoint_id);
create index submissions_created_idx on public.submissions (created_at desc);

create table public.quiz_answers (
  team_id       uuid not null references public.teams (id) on delete cascade,
  checkpoint_id uuid not null references public.checkpoints (id) on delete cascade,
  option        text not null check (option in ('A', 'B', 'C', 'D')),
  correct       boolean not null,
  answered_by   uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  primary key (team_id, checkpoint_id)  -- uma única tentativa por equipa e posto
);
create index quiz_answers_checkpoint_idx on public.quiz_answers (checkpoint_id);

create table public.adjustments (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  type       public.adjustment_type not null,
  points     smallint not null,
  reason     text not null default '' check (char_length(reason) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint adjustments_points_range check (
       (type = 'teamwork'     and points between 0 and 15)
    or (type = 'presentation' and points between 0 and 10)
    or (type = 'safety'       and points = -10)
  )
);
create unique index adjustments_one_teamwork on public.adjustments (team_id) where type = 'teamwork';
create unique index adjustments_one_presentation on public.adjustments (team_id) where type = 'presentation';
create index adjustments_team_idx on public.adjustments (team_id);

create table public.staff (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 80),
  role       public.staff_role not null default 'teacher',
  created_at timestamptz not null default now()
);

create table public.photo_votes (
  submission_id uuid not null references public.submissions (id) on delete cascade,
  staff_id      uuid not null references auth.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (submission_id, staff_id)
);
create index photo_votes_staff_idx on public.photo_votes (staff_id);

create table private.join_attempts (
  id           bigint generated always as identity primary key,
  user_id      uuid not null,
  attempted_at timestamptz not null default now(),
  success      boolean not null
);
create index join_attempts_user_idx on private.join_attempts (user_id, attempted_at desc);

-- -----------------------------------------------------------------------------
-- Funções auxiliares usadas nas políticas RLS (security definer, search_path vazio)
-- -----------------------------------------------------------------------------
create function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s where s.user_id = (select auth.uid()));
$$;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff s where s.user_id = (select auth.uid()) and s.role = 'admin');
$$;

create function private.my_team_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.team_id from public.team_members m where m.user_id = (select auth.uid());
$$;

create function private.my_event_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select t.event_id
  from public.team_members m join public.teams t on t.id = m.team_id
  where m.user_id = (select auth.uid());
$$;

-- Distância em metros entre dois pontos (fórmula de Haversine).
create function private.distance_m(lat1 double precision, lng1 double precision,
                                   lat2 double precision, lng2 double precision)
returns double precision
language sql immutable set search_path = '' as $$
  select 2 * 6371000 * asin(sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_staff(), private.is_admin(),
  private.my_team_id(), private.my_event_id() to authenticated;

-- -----------------------------------------------------------------------------
-- Permissões de tabela (defesa em profundidade; o RLS decide linha a linha)
-- -----------------------------------------------------------------------------
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all tables in schema public from anon;
-- As equipas nunca escrevem diretamente: só via RPC.
revoke insert, update on public.submissions, public.quiz_answers, public.adjustments,
  public.staff, public.team_members from authenticated;

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.events         enable row level security;
alter table public.checkpoints    enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.teams          enable row level security;
alter table public.team_members   enable row level security;
alter table public.submissions    enable row level security;
alter table public.quiz_answers   enable row level security;
alter table public.adjustments    enable row level security;
alter table public.staff          enable row level security;
alter table public.photo_votes    enable row level security;
alter table private.quiz_keys     enable row level security;  -- sem políticas: ninguém lê
alter table private.join_attempts enable row level security;  -- sem políticas: ninguém lê

-- events
create policy events_select on public.events for select to authenticated
  using ((select private.is_staff()) or id = (select private.my_event_id()));
create policy events_insert on public.events for insert to authenticated
  with check ((select private.is_staff()));
create policy events_update on public.events for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy events_delete on public.events for delete to authenticated
  using ((select private.is_admin()));

-- checkpoints
create policy checkpoints_select on public.checkpoints for select to authenticated
  using ((select private.is_staff()) or event_id = (select private.my_event_id()));
create policy checkpoints_insert on public.checkpoints for insert to authenticated
  with check ((select private.is_staff()));
create policy checkpoints_update on public.checkpoints for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy checkpoints_delete on public.checkpoints for delete to authenticated
  using ((select private.is_staff()));

-- quiz_questions (sem resposta certa)
create policy quiz_questions_select on public.quiz_questions for select to authenticated
  using (
    (select private.is_staff())
    or checkpoint_id in (select c.id from public.checkpoints c where c.event_id = (select private.my_event_id()))
  );
create policy quiz_questions_insert on public.quiz_questions for insert to authenticated
  with check ((select private.is_staff()));
create policy quiz_questions_update on public.quiz_questions for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy quiz_questions_delete on public.quiz_questions for delete to authenticated
  using ((select private.is_staff()));

-- teams
create policy teams_select on public.teams for select to authenticated
  using ((select private.is_staff()) or id = (select private.my_team_id()));
create policy teams_insert on public.teams for insert to authenticated
  with check ((select private.is_staff()));
create policy teams_update on public.teams for update to authenticated
  using ((select private.is_staff())) with check ((select private.is_staff()));
create policy teams_delete on public.teams for delete to authenticated
  using ((select private.is_staff()));

-- team_members (inserção só via join_team)
create policy team_members_select on public.team_members for select to authenticated
  using (
    (select private.is_staff())
    or user_id = (select auth.uid())
    or team_id = (select private.my_team_id())
  );
create policy team_members_delete on public.team_members for delete to authenticated
  using ((select private.is_staff()) or user_id = (select auth.uid()));

-- submissions (inserção e validação só via RPC)
create policy submissions_select on public.submissions for select to authenticated
  using ((select private.is_staff()) or team_id = (select private.my_team_id()));
create policy submissions_delete on public.submissions for delete to authenticated
  using ((select private.is_admin()));

-- quiz_answers (inserção só via submit_quiz_answer)
create policy quiz_answers_select on public.quiz_answers for select to authenticated
  using ((select private.is_staff()) or team_id = (select private.my_team_id()));

-- adjustments (inserção só via set_adjustment; a equipa vê os seus ajustes)
create policy adjustments_select on public.adjustments for select to authenticated
  using ((select private.is_staff()) or team_id = (select private.my_team_id()));
create policy adjustments_delete on public.adjustments for delete to authenticated
  using ((select private.is_staff()));

-- staff (cada utilizador vê a própria linha; professores veem a equipa docente)
create policy staff_select on public.staff for select to authenticated
  using ((select private.is_staff()) or user_id = (select auth.uid()));
create policy staff_delete on public.staff for delete to authenticated
  using ((select private.is_admin()) and user_id <> (select auth.uid()));

-- photo_votes (só professores; cada um gere os seus votos)
create policy photo_votes_select on public.photo_votes for select to authenticated
  using ((select private.is_staff()));
create policy photo_votes_insert on public.photo_votes for insert to authenticated
  with check ((select private.is_staff()) and staff_id = (select auth.uid()));
create policy photo_votes_delete on public.photo_votes for delete to authenticated
  using (staff_id = (select auth.uid()));
