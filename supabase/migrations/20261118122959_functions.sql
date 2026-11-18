-- =============================================================================
-- Tesouro EPA — Fase 1: funções RPC (equipas, professores, classificação)
-- =============================================================================
-- Todas as funções são security definer com search_path vazio e verificam
-- explicitamente quem as chama. Mensagens de erro em português (mostradas na app).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Auxiliares internas
-- -----------------------------------------------------------------------------
create function private.require_staff() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then
    raise exception 'Acesso reservado aos professores.' using errcode = '42501';
  end if;
end $$;

create function private.require_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Acesso reservado ao administrador.' using errcode = '42501';
  end if;
end $$;

-- Normaliza o que a equipa escreve: "epa 7k3q", "7K3Q", "EPA7K3Q" -> "EPA-7K3Q".
create function private.normalize_code(p_code text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if v ~ '^[A-Z0-9]{4}$' then
    return 'EPA-' || v;
  elsif v ~ '^EPA[A-Z0-9]{4}$' then
    return 'EPA-' || substr(v, 4);
  end if;
  return v;
end $$;

-- Gera um código único EPA-XXXX (sem 0/O/1/I para evitar confusões).
create function private.generate_team_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- 32 símbolos
  bytes bytea;
  candidate text;
begin
  loop
    bytes := extensions.gen_random_bytes(4);
    candidate := 'EPA-';
    for i in 0..3 loop
      candidate := candidate || substr(alphabet, 1 + (get_byte(bytes, i) % 32), 1);
    end loop;
    exit when not exists (select 1 from public.teams t where t.code = candidate);
  end loop;
  return candidate;
end $$;

-- -----------------------------------------------------------------------------
-- Pontuação (fonte única de verdade)
-- -----------------------------------------------------------------------------
-- Quiz certo: 10 · Desafio validado: 0–15 · Trabalho de equipa: 0–15
-- Apresentação: 0–10 · Segurança: −10 cada · Atraso: −5 por cada bloco de 5 min
-- (começado) após a hora limite; se a equipa ainda não chegou, conta até agora.
create function private.team_scores(p_event_id uuid)
returns table (
  team_id             uuid,
  team_name           text,
  class_name          text,
  start_seq           smallint,
  arrived_at          timestamptz,
  deadline_at         timestamptz,
  quiz_correct        integer,
  quiz_points         integer,
  validated_count     integer,
  pending_count       integer,
  challenge_points    integer,
  teamwork_points     integer,
  presentation_points integer,
  safety_count        integer,
  safety_points       integer,
  late_minutes        integer,
  late_penalty        integer,
  total               integer
)
language sql stable security definer set search_path = '' as $$
  with base as (
    select t.id, t.name, t.class_name, t.start_seq, t.arrived_at,
           coalesce(t.deadline_at, e.deadline_at) as deadline
    from public.teams t
    join public.events e on e.id = t.event_id
    where t.event_id = p_event_id
  ),
  q as (
    select a.team_id, count(*) filter (where a.correct)::int as n
    from public.quiz_answers a join base b on b.id = a.team_id
    group by a.team_id
  ),
  s as (
    select x.team_id,
           count(*) filter (where x.status = 'approved')::int as validated,
           count(*) filter (where x.status = 'pending')::int  as pending,
           coalesce(sum(x.challenge_points) filter (where x.status = 'approved'), 0)::int as pts
    from public.submissions x join base b on b.id = x.team_id
    group by x.team_id
  ),
  adj as (
    select a.team_id,
           coalesce(sum(a.points) filter (where a.type = 'teamwork'), 0)::int     as tw,
           coalesce(sum(a.points) filter (where a.type = 'presentation'), 0)::int as pr,
           count(*) filter (where a.type = 'safety')::int                         as sc,
           coalesce(sum(a.points) filter (where a.type = 'safety'), 0)::int       as sp
    from public.adjustments a join base b on b.id = a.team_id
    group by a.team_id
  ),
  late as (
    select b.id,
           greatest(0, extract(epoch from (coalesce(b.arrived_at, now()) - b.deadline)))::numeric as secs
    from base b
  ),
  scored as (
    select b.id, b.name, b.class_name, b.start_seq, b.arrived_at, b.deadline,
           coalesce(q.n, 0)          as quiz_correct,
           coalesce(q.n, 0) * 10     as quiz_points,
           coalesce(s.validated, 0)  as validated_count,
           coalesce(s.pending, 0)    as pending_count,
           coalesce(s.pts, 0)        as challenge_points,
           coalesce(adj.tw, 0)       as teamwork_points,
           coalesce(adj.pr, 0)       as presentation_points,
           coalesce(adj.sc, 0)       as safety_count,
           coalesce(adj.sp, 0)       as safety_points,
           ceil(l.secs / 60)::int    as late_minutes,
           (-5 * ceil(l.secs / 300))::int as late_penalty
    from base b
    join late l on l.id = b.id
    left join q   on q.team_id = b.id
    left join s   on s.team_id = b.id
    left join adj on adj.team_id = b.id
  )
  select id, name, class_name, start_seq, arrived_at, deadline,
         quiz_correct, quiz_points, validated_count, pending_count, challenge_points,
         teamwork_points, presentation_points, safety_count, safety_points,
         late_minutes, late_penalty,
         quiz_points + challenge_points + teamwork_points + presentation_points
           + safety_points + late_penalty as total
  from scored;
$$;

-- Classificação completa (só professores). Desempate: total → desafios validados
-- → pontos de trabalho de equipa (atitude) → chegada mais cedo → nome.
create function public.leaderboard(p_event_id uuid)
returns table (
  rank                integer,
  team_id             uuid,
  team_name           text,
  class_name          text,
  start_seq           smallint,
  arrived_at          timestamptz,
  deadline_at         timestamptz,
  quiz_correct        integer,
  quiz_points         integer,
  validated_count     integer,
  pending_count       integer,
  challenge_points    integer,
  teamwork_points     integer,
  presentation_points integer,
  safety_count        integer,
  safety_points       integer,
  late_minutes        integer,
  late_penalty        integer,
  total               integer
)
language sql stable security definer set search_path = '' as $$
  select (row_number() over (
            order by s.total desc, s.validated_count desc, s.teamwork_points desc,
                     s.arrived_at asc nulls last, s.team_name))::int,
         s.*
  from private.team_scores(p_event_id) s
  where private.is_staff()
  order by 1;
$$;

-- Pontuação da própria equipa (para o ecrã inicial dos alunos).
create function public.my_team_score()
returns table (
  team_id             uuid,
  quiz_correct        integer,
  quiz_points         integer,
  validated_count     integer,
  pending_count       integer,
  challenge_points    integer,
  teamwork_points     integer,
  presentation_points integer,
  safety_count        integer,
  safety_points       integer,
  late_minutes        integer,
  late_penalty        integer,
  total               integer
)
language sql stable security definer set search_path = '' as $$
  select s.team_id, s.quiz_correct, s.quiz_points, s.validated_count, s.pending_count,
         s.challenge_points, s.teamwork_points, s.presentation_points, s.safety_count,
         s.safety_points, s.late_minutes, s.late_penalty, s.total
  from private.team_scores(private.my_event_id()) s
  where s.team_id = private.my_team_id();
$$;

-- -----------------------------------------------------------------------------
-- RPC das equipas
-- -----------------------------------------------------------------------------

-- Entrar numa equipa com o código. Devolve JSON {ok, team_id, team_name} ou
-- {ok:false, error}. Não lança exceção em código errado para que a tentativa
-- falhada fique registada (limite: 10 falhas em 10 minutos por sessão).
create function public.join_team(p_code text) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid    uuid := auth.uid();
  v_code   text := private.normalize_code(p_code);
  v_team   public.teams;
  v_failed integer;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'Sessão inválida. Recarrega a página e tenta de novo.');
  end if;

  select count(*) into v_failed
  from private.join_attempts j
  where j.user_id = v_uid and not j.success and j.attempted_at > now() - interval '10 minutes';
  if v_failed >= 10 then
    return json_build_object('ok', false,
      'error', 'Demasiadas tentativas falhadas. Espera 10 minutos ou pede ajuda ao professor.');
  end if;

  select t.* into v_team
  from public.teams t join public.events e on e.id = t.event_id
  where t.code = v_code and e.active;

  if not found then
    insert into private.join_attempts (user_id, success) values (v_uid, false);
    return json_build_object('ok', false, 'error', 'Código inválido. Confirma o código com o professor.');
  end if;

  insert into private.join_attempts (user_id, success) values (v_uid, true);
  insert into public.team_members (user_id, team_id) values (v_uid, v_team.id)
  on conflict (user_id) do update set team_id = excluded.team_id, joined_at = now();

  return json_build_object('ok', true, 'team_id', v_team.id, 'team_name', v_team.name);
end $$;

-- Responder ao quiz: uma única tentativa por equipa e posto. Devolve só se
-- acertou (nunca a opção certa). Se outro telemóvel da equipa já respondeu,
-- devolve essa resposta com already_answered = true.
create function public.submit_quiz_answer(p_checkpoint_id uuid, p_option text) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_team    uuid := private.my_team_id();
  v_option  text := upper(trim(coalesce(p_option, '')));
  v_correct text;
  v_row     public.quiz_answers;
begin
  if v_team is null then
    raise exception 'Não estás associado a nenhuma equipa.' using errcode = '42501';
  end if;
  if v_option not in ('A', 'B', 'C', 'D') then
    raise exception 'Opção inválida.' using errcode = '22023';
  end if;

  select k.correct_option into v_correct
  from private.quiz_keys k
  join public.checkpoints c on c.id = k.checkpoint_id
  join public.teams t on t.event_id = c.event_id
  where k.checkpoint_id = p_checkpoint_id and t.id = v_team;

  if v_correct is null then
    raise exception 'Pergunta não encontrada.' using errcode = 'P0002';
  end if;

  insert into public.quiz_answers (team_id, checkpoint_id, option, correct, answered_by)
  values (v_team, p_checkpoint_id, v_option, v_option = v_correct, auth.uid())
  on conflict (team_id, checkpoint_id) do nothing
  returning * into v_row;

  if found then
    return json_build_object('correct', v_row.correct, 'option', v_row.option, 'already_answered', false);
  end if;

  select * into v_row from public.quiz_answers a
  where a.team_id = v_team and a.checkpoint_id = p_checkpoint_id;
  return json_build_object('correct', v_row.correct, 'option', v_row.option, 'already_answered', true);
end $$;

-- Registar uma submissão depois de a fotografia estar no Storage.
-- A distância ao posto e o "fora da área" são calculados AQUI, no servidor.
create function public.create_submission(
  p_id             uuid,
  p_checkpoint_id  uuid,
  p_photo_path     text,
  p_challenge_text text default null,
  p_lat            double precision default null,
  p_lng            double precision default null,
  p_accuracy_m     real default null,
  p_gps_status     text default 'unavailable',
  p_taken_at       timestamptz default null
) returns public.submissions
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_team public.teams;
  v_cp   public.checkpoints;
  v_sub  public.submissions;
  v_gps  public.gps_status;
  v_dist double precision;
begin
  select t.* into v_team from public.teams t where t.id = private.my_team_id();
  if not found then
    raise exception 'Não estás associado a nenhuma equipa.' using errcode = '42501';
  end if;

  -- Reenvio da fila offline: devolve a submissão já registada.
  select s.* into v_sub from public.submissions s where s.id = p_id;
  if found then
    if v_sub.team_id <> v_team.id then
      raise exception 'Submissão inválida.' using errcode = '42501';
    end if;
    return v_sub;
  end if;

  select c.* into v_cp from public.checkpoints c
  where c.id = p_checkpoint_id and c.event_id = v_team.event_id;
  if not found then
    raise exception 'Posto não encontrado.' using errcode = 'P0002';
  end if;

  if p_photo_path is null
     or p_photo_path !~ ('^' || v_team.event_id || '/' || v_team.id || '/' || v_cp.id || '/[A-Za-z0-9_-]{1,64}\.jpg$') then
    raise exception 'Caminho da fotografia inválido.' using errcode = '22023';
  end if;

  if not exists (select 1 from storage.objects o where o.bucket_id = 'photos' and o.name = p_photo_path) then
    raise exception 'A fotografia ainda não chegou ao servidor. Tenta enviar de novo.' using errcode = 'P0002';
  end if;

  v_gps := case when p_gps_status in ('ok', 'denied', 'unavailable')
                then p_gps_status::public.gps_status else 'unavailable' end;
  if v_gps = 'ok' and (p_lat is null or p_lng is null
                       or p_lat not between -90 and 90 or p_lng not between -180 and 180) then
    v_gps := 'unavailable';
  end if;
  if v_gps = 'ok' then
    v_dist := private.distance_m(p_lat, p_lng, v_cp.lat, v_cp.lng);
  end if;

  begin
    insert into public.submissions (
      id, team_id, checkpoint_id, photo_path, challenge_text,
      lat, lng, accuracy_m, gps_status, distance_m, out_of_area, taken_at, submitted_by
    ) values (
      p_id, v_team.id, v_cp.id, p_photo_path, nullif(left(trim(coalesce(p_challenge_text, '')), 600), ''),
      case when v_gps = 'ok' then p_lat end,
      case when v_gps = 'ok' then p_lng end,
      case when v_gps = 'ok' then p_accuracy_m end,
      v_gps, v_dist, coalesce(v_dist > v_cp.radius_m, false),
      least(coalesce(p_taken_at, now()), now()), auth.uid()
    )
    returning * into v_sub;
  exception when unique_violation then
    raise exception 'Este posto já tem uma fotografia enviada. Aguarda a validação do professor.'
      using errcode = '23505';
  end;

  return v_sub;
end $$;

-- "Chegámos à EPA": regista a hora de chegada (hora do servidor), uma vez.
create function public.mark_arrival(p_lat double precision default null, p_lng double precision default null)
returns timestamptz
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_team uuid := private.my_team_id();
  v_at   timestamptz;
begin
  if v_team is null then
    raise exception 'Não estás associado a nenhuma equipa.' using errcode = '42501';
  end if;

  update public.teams t
     set arrived_at = now(),
         arrival_lat = p_lat,
         arrival_lng = p_lng,
         arrival_distance_m = case when p_lat is not null and p_lng is not null
                                   then private.distance_m(p_lat, p_lng, e.base_lat, e.base_lng) end
    from public.events e
   where t.id = v_team and e.id = t.event_id and t.arrived_at is null
  returning t.arrived_at into v_at;

  if v_at is null then
    select t.arrived_at into v_at from public.teams t where t.id = v_team;
  end if;
  return v_at;
end $$;

-- -----------------------------------------------------------------------------
-- RPC dos professores
-- -----------------------------------------------------------------------------

-- Validar (approved), rejeitar (rejected) ou voltar a pendente (pending).
create function public.review_submission(
  p_id               uuid,
  p_status           text,
  p_points_photo     integer default null,
  p_points_relevance integer default null,
  p_points_text      integer default null,
  p_comment          text default null
) returns public.submissions
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_sub public.submissions;
begin
  perform private.require_staff();
  if p_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Estado inválido.' using errcode = '22023';
  end if;
  if p_status = 'approved' and (
       p_points_photo is null or p_points_relevance is null or p_points_text is null
       or p_points_photo not between 0 and 5 or p_points_relevance not between 0 and 5
       or p_points_text not between 0 and 5) then
    raise exception 'Para validar, atribui 0 a 5 pontos em cada critério.' using errcode = '22023';
  end if;

  begin
    update public.submissions s
       set status           = p_status::public.submission_status,
           points_photo     = case when p_status = 'approved' then p_points_photo end,
           points_relevance = case when p_status = 'approved' then p_points_relevance end,
           points_text      = case when p_status = 'approved' then p_points_text end,
           teacher_comment  = nullif(left(trim(coalesce(p_comment, '')), 500), ''),
           reviewed_by      = case when p_status = 'pending' then null else auth.uid() end,
           reviewed_at      = case when p_status = 'pending' then null else now() end
     where s.id = p_id
    returning * into v_sub;
  exception when unique_violation then
    raise exception 'Esta equipa já tem outra submissão ativa neste posto.' using errcode = '23505';
  end;

  if not found then
    raise exception 'Submissão não encontrada.' using errcode = 'P0002';
  end if;
  return v_sub;
end $$;

-- Pontos extra e penalizações. teamwork/presentation substituem o valor
-- anterior; safety acrescenta uma penalização de −10.
create function public.set_adjustment(
  p_team_id uuid,
  p_type    text,
  p_points  integer default null,
  p_reason  text default ''
) returns public.adjustments
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_row public.adjustments;
begin
  perform private.require_staff();
  if p_type not in ('teamwork', 'presentation', 'safety') then
    raise exception 'Tipo de ajuste inválido.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.teams t where t.id = p_team_id) then
    raise exception 'Equipa não encontrada.' using errcode = 'P0002';
  end if;

  if p_type in ('teamwork', 'presentation') then
    delete from public.adjustments a where a.team_id = p_team_id and a.type = p_type::public.adjustment_type;
  end if;

  insert into public.adjustments (team_id, type, points, reason, created_by)
  values (p_team_id, p_type::public.adjustment_type,
          case when p_type = 'safety' then -10 else p_points end,
          left(trim(coalesce(p_reason, '')), 300), auth.uid())
  returning * into v_row;
  return v_row;
exception when check_violation or not_null_violation then
  raise exception 'Pontos fora do limite (trabalho de equipa 0–15, apresentação 0–10).' using errcode = '22023';
end $$;

-- Criar equipa com código gerado automaticamente.
create function public.create_team(
  p_event_id    uuid,
  p_name        text,
  p_class_name  text default '',
  p_start_seq   integer default 1,
  p_deadline_at timestamptz default null
) returns public.teams
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_team public.teams;
begin
  perform private.require_staff();
  insert into public.teams (event_id, name, class_name, code, start_seq, deadline_at)
  values (p_event_id, trim(p_name), trim(coalesce(p_class_name, '')),
          private.generate_team_code(), coalesce(p_start_seq, 1), p_deadline_at)
  returning * into v_team;
  return v_team;
exception when unique_violation then
  raise exception 'Já existe uma equipa com esse nome neste evento.' using errcode = '23505';
end $$;

-- Gerar um novo código (ex.: se o código foi partilhado por engano).
create function public.regenerate_team_code(p_team_id uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_code text;
begin
  perform private.require_staff();
  update public.teams t set code = private.generate_team_code()
   where t.id = p_team_id returning t.code into v_code;
  if v_code is null then
    raise exception 'Equipa não encontrada.' using errcode = 'P0002';
  end if;
  return v_code;
end $$;

-- Distribuir os postos iniciais o mais espaçados possível pelos 7 postos
-- (ex.: 3 equipas → 1, 3, 5; 7 equipas → 1..7; 10 equipas → repetem-se postos).
create function public.distribute_start_seqs(p_event_id uuid) returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_count integer;
begin
  perform private.require_staff();
  with ordered as (
    select t.id,
           row_number() over (order by t.created_at, t.name) - 1 as rn,
           count(*) over () as n
    from public.teams t where t.event_id = p_event_id
  )
  update public.teams t
     set start_seq = (floor(o.rn * 7.0 / o.n) + 1)::smallint
    from ordered o
   where t.id = o.id;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Corrigir manualmente a hora de chegada (null = ainda não chegou).
create function public.set_team_arrival(p_team_id uuid, p_arrived_at timestamptz) returns public.teams
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_team public.teams;
begin
  perform private.require_staff();
  update public.teams t set arrived_at = p_arrived_at where t.id = p_team_id returning * into v_team;
  if not found then
    raise exception 'Equipa não encontrada.' using errcode = 'P0002';
  end if;
  return v_team;
end $$;

-- Última posição conhecida de cada equipa (vem da última submissão com GPS).
create function public.team_last_positions(p_event_id uuid)
returns table (team_id uuid, lat double precision, lng double precision,
               seen_at timestamptz, checkpoint_seq smallint)
language sql stable security definer set search_path = '' as $$
  select distinct on (s.team_id) s.team_id, s.lat, s.lng, s.created_at, c.seq
  from public.submissions s
  join public.teams t on t.id = s.team_id
  join public.checkpoints c on c.id = s.checkpoint_id
  where t.event_id = p_event_id and s.gps_status = 'ok' and private.is_staff()
  order by s.team_id, s.created_at desc;
$$;

-- Respostas certas do quiz (só professores, para o editor de postos).
create function public.staff_quiz_keys(p_event_id uuid)
returns table (checkpoint_id uuid, correct_option text)
language sql stable security definer set search_path = '' as $$
  select k.checkpoint_id, k.correct_option
  from private.quiz_keys k join public.checkpoints c on c.id = k.checkpoint_id
  where c.event_id = p_event_id and private.is_staff();
$$;

-- Criar ou alterar a pergunta de um posto (incluindo a resposta certa).
create function public.staff_upsert_quiz(
  p_checkpoint_id uuid, p_question text, p_options jsonb, p_correct text
) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_staff();
  if upper(p_correct) not in ('A', 'B', 'C', 'D') then
    raise exception 'A resposta certa tem de ser A, B, C ou D.' using errcode = '22023';
  end if;
  insert into public.quiz_questions (checkpoint_id, question, options)
  values (p_checkpoint_id, p_question, p_options)
  on conflict (checkpoint_id) do update set question = excluded.question, options = excluded.options;
  insert into private.quiz_keys (checkpoint_id, correct_option)
  values (p_checkpoint_id, upper(p_correct))
  on conflict (checkpoint_id) do update set correct_option = excluded.correct_option;
end $$;

-- -----------------------------------------------------------------------------
-- Administração
-- -----------------------------------------------------------------------------

-- Lista de professores com email (o email vem de auth.users, só para admins/staff).
create function public.list_staff()
returns table (user_id uuid, name text, role public.staff_role, email text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select s.user_id, s.name, s.role, u.email::text, s.created_at
  from public.staff s join auth.users u on u.id = s.user_id
  where private.is_staff()
  order by s.name;
$$;

-- Dar acesso de professor a uma conta já criada em Authentication → Users.
create function public.admin_add_staff(p_email text, p_name text, p_role text default 'teacher')
returns public.staff
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid;
  v_row public.staff;
begin
  perform private.require_admin();
  if p_role not in ('teacher', 'admin') then
    raise exception 'Papel inválido.' using errcode = '22023';
  end if;
  select u.id into v_uid from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_uid is null then
    raise exception 'Não existe nenhuma conta com esse email. Cria primeiro o utilizador no Supabase (Authentication → Users).'
      using errcode = 'P0002';
  end if;
  insert into public.staff (user_id, name, role) values (v_uid, trim(p_name), p_role::public.staff_role)
  on conflict (user_id) do update set name = excluded.name, role = excluded.role
  returning * into v_row;
  return v_row;
end $$;

-- Caminhos das fotos de um evento (para o admin as apagar via Storage API).
create function public.admin_event_photo_paths(p_event_id uuid) returns setof text
language sql stable security definer set search_path = '' as $$
  select o.name from storage.objects o
  where o.bucket_id = 'photos' and o.name like p_event_id::text || '/%' and private.is_admin();
$$;

-- Apagar todos os dados das equipas de um evento (e, opcionalmente, o evento).
-- As fotos devem ser apagadas antes pela app (Storage API); a função devolve
-- quantas ainda restam. As sessões anónimas dos alunos também são removidas.
create function public.purge_event(p_event_id uuid, p_delete_event boolean default false) returns json
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_users   uuid[];
  v_teams   integer;
  v_users_n integer := 0;
  v_photos  integer;
begin
  perform private.require_admin();

  select coalesce(array_agg(m.user_id), '{}') into v_users
  from public.team_members m join public.teams t on t.id = m.team_id
  where t.event_id = p_event_id;

  delete from public.teams t where t.event_id = p_event_id;  -- cascata: membros, submissões, respostas, ajustes, votos
  get diagnostics v_teams = row_count;

  begin
    delete from auth.users u
     where u.id = any (v_users) and u.is_anonymous
       and not exists (select 1 from public.staff s where s.user_id = u.id);
    get diagnostics v_users_n = row_count;
  exception when others then
    v_users_n := -1;  -- sem permissão: apagar em Authentication → Users
  end;

  if p_delete_event then
    delete from public.events e where e.id = p_event_id;
  end if;

  select count(*) into v_photos from storage.objects o
  where o.bucket_id = 'photos' and o.name like p_event_id::text || '/%';

  return json_build_object('teams_deleted', v_teams, 'anonymous_users_deleted', v_users_n,
                           'photos_remaining', v_photos, 'event_deleted', p_delete_event);
end $$;

-- -----------------------------------------------------------------------------
-- Permissões de execução: nada para anon; tudo o resto exige sessão
-- (anónima ou professor) e as funções verificam o papel por dentro.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on all functions in schema private from public, anon;
grant execute on function private.is_staff(), private.is_admin(),
  private.my_team_id(), private.my_event_id() to authenticated;
