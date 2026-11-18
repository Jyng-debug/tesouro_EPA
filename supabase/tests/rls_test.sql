-- =============================================================================
-- Tesouro EPA — teste de segurança (RLS + RPC)
-- =============================================================================
-- Simula 3 sessões anónimas de alunos e 1 professor, e verifica que cada um só
-- vê e faz o que deve. Corre tudo dentro de uma transação que é desfeita no fim
-- (ROLLBACK): não deixa dados na base de dados.
--
-- Como correr: Supabase → SQL Editor → colar este ficheiro → Run.
-- Resultado esperado: a última linha diz "TODOS OS TESTES PASSARAM".
-- Se algum teste falhar, aparece um erro "FALHOU: ..." e nada é gravado.
-- Requer os dados de teste (equipas EPA-TST1/2/3).
-- =============================================================================

begin;

-- ---------------------------------------------------------------- preparação
insert into auth.users (id, instance_id, aud, role, is_anonymous, created_at, updated_at)
values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now()),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now()),
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', true, now(), now());
insert into auth.users (id, instance_id, aud, role, email, is_anonymous, created_at, updated_at)
values ('b0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'professor.teste@example.com', false, now(), now());
insert into public.staff (user_id, name, role) values ('b0000000-0000-4000-8000-000000000001', 'Professor Teste', 'teacher');

select set_config('test.event', (select id::text from public.events where active), true);
select set_config('test.team1', (select id::text from public.teams where code = 'EPA-TST1'), true);
select set_config('test.team2', (select id::text from public.teams where code = 'EPA-TST2'), true);
select set_config('test.cp1', (select c.id::text from public.checkpoints c join public.events e on e.id = c.event_id
                               where e.active and c.seq = 1), true);
select set_config('test.photo1', current_setting('test.event') || '/' || current_setting('test.team1') || '/'
                                 || current_setting('test.cp1') || '/1700000000000.jpg', true);

-- --------------------------------------------------- aluno 1 entra na equipa 1
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}', true);

do $$
declare r json;
begin
  r := public.join_team('epa tst1');
  if not (r->>'ok')::boolean then raise exception 'FALHOU: join_team com código válido (%)', r; end if;
  r := public.join_team('EPA-ZZZZ');
  if (r->>'ok')::boolean then raise exception 'FALHOU: join_team aceitou código inválido'; end if;
  -- o código errado não deve ter tirado o aluno da equipa
  if private.my_team_id() is distinct from current_setting('test.team1')::uuid then
    raise exception 'FALHOU: aluno perdeu a equipa após código errado';
  end if;
end $$;

do $$
begin
  if (select count(*) from public.teams) <> 1 then raise exception 'FALHOU: aluno vê outras equipas'; end if;
  if (select count(*) from public.checkpoints) <> 7 then raise exception 'FALHOU: aluno não vê os 7 postos'; end if;
  if (select count(*) from public.quiz_questions) <> 7 then raise exception 'FALHOU: aluno não vê as 7 perguntas'; end if;
  if (select count(*) from public.events) <> 1 then raise exception 'FALHOU: aluno não vê o seu evento'; end if;
  if (select count(*) from public.leaderboard(current_setting('test.event')::uuid)) <> 0 then
    raise exception 'FALHOU: aluno vê a classificação geral';
  end if;
  if (select count(*) from public.staff_quiz_keys(current_setting('test.event')::uuid)) <> 0 then
    raise exception 'FALHOU: aluno vê as respostas certas';
  end if;
end $$;

-- a tabela das respostas certas tem de estar inacessível
do $$
begin
  perform * from private.quiz_keys;
  raise exception 'FALHOU: aluno conseguiu ler private.quiz_keys';
exception when insufficient_privilege then null;
end $$;

-- escrita direta em tabelas tem de falhar
do $$
begin
  insert into public.quiz_answers (team_id, checkpoint_id, option, correct)
  values (current_setting('test.team1')::uuid, current_setting('test.cp1')::uuid, 'A', true);
  raise exception 'FALHOU: aluno inseriu diretamente em quiz_answers';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  update public.teams set name = 'Hackers' where id = current_setting('test.team1')::uuid;
  if exists (select 1 from public.teams where name = 'Hackers') then
    raise exception 'FALHOU: aluno alterou a equipa diretamente';
  end if;
end $$;

-- quiz: uma tentativa; a segunda devolve a primeira resposta
do $$
declare r json;
begin
  r := public.submit_quiz_answer(current_setting('test.cp1')::uuid, 'b');
  if not (r->>'correct')::boolean or (r->>'already_answered')::boolean then
    raise exception 'FALHOU: resposta certa não reconhecida (%)', r;
  end if;
  if r::jsonb ? 'correct_option' then raise exception 'FALHOU: resposta certa exposta'; end if;
  r := public.submit_quiz_answer(current_setting('test.cp1')::uuid, 'A');
  if not (r->>'already_answered')::boolean or r->>'option' <> 'B' then
    raise exception 'FALHOU: segunda tentativa aceite (%)', r;
  end if;
end $$;

-- storage: só na pasta da própria equipa
do $$
begin
  insert into storage.objects (bucket_id, name) values ('photos', current_setting('test.photo1'));
exception when others then
  raise exception 'FALHOU: aluno não conseguiu carregar foto na sua pasta (%)', sqlerrm;
end $$;

do $$
begin
  insert into storage.objects (bucket_id, name) values ('photos',
    current_setting('test.event') || '/' || current_setting('test.team2') || '/' || current_setting('test.cp1') || '/1.jpg');
  raise exception 'FALHOU: aluno carregou foto na pasta de outra equipa';
exception when insufficient_privilege then null;
end $$;

-- submissão: distância calculada no servidor (≈ 111 m a norte do posto 1 → fora da área)
do $$
declare s public.submissions;
begin
  s := public.create_submission('c0000000-0000-4000-8000-000000000001', current_setting('test.cp1')::uuid,
         current_setting('test.photo1'), '  Painel com a apanha do moliço; elevador na estação nova.  ',
         40.6448, -8.6409, 12, 'ok', null);
  if s.distance_m is null or s.distance_m not between 100 and 125 then
    raise exception 'FALHOU: distância mal calculada (%)', s.distance_m;
  end if;
  if not s.out_of_area then raise exception 'FALHOU: devia estar fora da área'; end if;
  if s.status <> 'pending' then raise exception 'FALHOU: estado inicial devia ser pending'; end if;
  -- reenvio da fila offline com o mesmo id: idempotente
  s := public.create_submission('c0000000-0000-4000-8000-000000000001', current_setting('test.cp1')::uuid,
         current_setting('test.photo1'));
  if s.id <> 'c0000000-0000-4000-8000-000000000001' then raise exception 'FALHOU: reenvio não idempotente'; end if;
end $$;

-- aluno não pode validar
do $$
begin
  perform public.review_submission('c0000000-0000-4000-8000-000000000001', 'approved', 5, 5, 5, null);
  raise exception 'FALHOU: aluno validou uma submissão';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  perform public.mark_arrival(40.6468, -8.6455);
  if (select arrived_at from public.teams) is null then raise exception 'FALHOU: chegada não registada'; end if;
end $$;

-- --------------------------------------------------- aluno 2 (equipa 2) não vê a equipa 1
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true}', true);
do $$
declare r json;
begin
  r := public.join_team('TST2');
  if not (r->>'ok')::boolean then raise exception 'FALHOU: join_team TST2 (%)', r; end if;
  if (select count(*) from public.submissions) <> 0 then raise exception 'FALHOU: equipa 2 vê submissões da equipa 1'; end if;
  if (select count(*) from public.quiz_answers) <> 0 then raise exception 'FALHOU: equipa 2 vê respostas da equipa 1'; end if;
  if (select count(*) from storage.objects where bucket_id = 'photos') <> 0 then
    raise exception 'FALHOU: equipa 2 vê fotos da equipa 1';
  end if;
  if (select count(*) from public.team_members) <> 1 then raise exception 'FALHOU: equipa 2 vê membros de outras equipas'; end if;
end $$;

-- --------------------------------------------------- aluno 3 (sem equipa) não vê nada
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated","is_anonymous":true}', true);
do $$
begin
  if (select count(*) from public.teams) <> 0 or (select count(*) from public.checkpoints) <> 0
     or (select count(*) from public.events) <> 0 then
    raise exception 'FALHOU: sessão sem equipa vê dados';
  end if;
  begin
    perform public.submit_quiz_answer(current_setting('test.cp1')::uuid, 'A');
    raise exception 'FALHOU: sessão sem equipa respondeu ao quiz';
  exception when insufficient_privilege then null;
  end;
end $$;

-- --------------------------------------------------- professor valida e pontua
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare
  s public.submissions;
  t1 record;
begin
  if (select count(*) from public.teams where event_id = current_setting('test.event')::uuid) <> 3 then
    raise exception 'FALHOU: professor não vê as 3 equipas';
  end if;
  if (select count(*) from public.staff_quiz_keys(current_setting('test.event')::uuid)) <> 7 then
    raise exception 'FALHOU: professor não vê as respostas certas';
  end if;

  s := public.review_submission('c0000000-0000-4000-8000-000000000001', 'approved', 5, 4, 3, 'Boa foto!');
  if s.challenge_points <> 12 or s.reviewed_by is null then raise exception 'FALHOU: validação (%)', s.challenge_points; end if;

  perform public.set_adjustment(current_setting('test.team1')::uuid, 'teamwork', 12, 'Equipa unida');
  perform public.set_adjustment(current_setting('test.team1')::uuid, 'teamwork', 13, 'Corrigido');  -- substitui
  perform public.set_adjustment(current_setting('test.team1')::uuid, 'safety', null, 'Atravessou fora da passadeira');

  begin
    perform public.set_adjustment(current_setting('test.team1')::uuid, 'presentation', 11, '');
    raise exception 'FALHOU: aceitou apresentação acima de 10';
  exception when invalid_parameter_value then null;
  end;

  select * into t1 from public.leaderboard(current_setting('test.event')::uuid) where team_id = current_setting('test.team1')::uuid;
  -- 10 (quiz) + 12 (desafio) + 13 (equipa) − 10 (segurança) = 25
  if t1.total <> 25 or t1.rank <> 1 or t1.quiz_points <> 10 or t1.challenge_points <> 12 then
    raise exception 'FALHOU: classificação (total %, rank %)', t1.total, t1.rank;
  end if;

  if public.distribute_start_seqs(current_setting('test.event')::uuid) <> 3 then
    raise exception 'FALHOU: distribuir postos';
  end if;
  if (select array_agg(start_seq order by created_at, name) from public.teams
      where event_id = current_setting('test.event')::uuid) <> array[1, 3, 5]::smallint[] then
    raise exception 'FALHOU: distribuição esperada 1, 3, 5';
  end if;

  -- professor (não admin) não pode apagar o evento
  begin
    perform public.purge_event(current_setting('test.event')::uuid, false);
    raise exception 'FALHOU: professor sem papel admin apagou dados';
  exception when insufficient_privilege then null;
  end;
end $$;

-- --------------------------------------------------- aluno 1 vê a sua pontuação e o comentário
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":true}', true);
do $$
begin
  if (select total from public.my_team_score()) <> 25 then raise exception 'FALHOU: my_team_score'; end if;
  if (select teacher_comment from public.submissions) <> 'Boa foto!' then raise exception 'FALHOU: aluno não vê o comentário'; end if;
end $$;

reset role;
select 'TODOS OS TESTES PASSARAM' as resultado;
rollback;
