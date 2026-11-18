-- =============================================================================
-- Tesouro EPA — Fase 1: dados iniciais (evento de teste)
-- =============================================================================
-- Cria um evento de TESTE ativo, os 7 postos com desafios e perguntas, e
-- 3 equipas com códigos conhecidos: EPA-TST1, EPA-TST2, EPA-TST3.
-- A hora limite é propositadamente distante para não gerar penalizações de
-- atraso durante os testes. Antes da atividade real: criar o evento real no
-- painel (copiando os postos) e apagar este evento com o botão de admin.
-- As respostas certas ficam em private.quiz_keys e nunca vão para o frontend.
-- =============================================================================

do $seed$
declare
  v_event uuid;
  v_cp    uuid;
begin
  insert into public.events (name, event_date, starts_at, deadline_at, active, coordinator_name, coordinator_phone)
  values ('Evento de teste — Caça ao Tesouro da Cidadania',
          date '2026-11-18',
          timestamptz '2026-11-18 09:00 Europe/Lisbon',
          timestamptz '2026-12-31 18:00 Europe/Lisbon',
          true,
          'Diretor de Curso TDS',
          null)
  returning id into v_event;

  -- 1 · Estação de Aveiro ------------------------------------------------------
  insert into public.checkpoints (event_id, seq, name, theme, description, challenge, text_prompt, lat, lng)
  values (v_event, 1, 'Estação de Aveiro (antiga e nova)', 'Património e acessibilidade',
    'A antiga estação ferroviária é conhecida pelos painéis de azulejos com cenas da região. Mesmo ao lado fica a estação nova.',
    'Fotografem um painel de azulejos com uma atividade tradicional da região e um exemplo de acessibilidade na estação nova (rampa, elevador, piso tátil ou sinalética).',
    'Que atividade tradicional mostra o painel e que exemplo de acessibilidade encontraram?',
    40.6438, -8.6409)
  returning id into v_cp;
  insert into public.quiz_questions (checkpoint_id, question, options) values (v_cp,
    'Os painéis de azulejos da antiga estação, colocados em 1916, foram produzidos em que fábrica aveirense?',
    '{"A":"Vista Alegre","B":"Fábrica da Fonte Nova","C":"Bordallo Pinheiro","D":"Viúva Lamego"}');
  insert into private.quiz_keys (checkpoint_id, correct_option) values (v_cp, 'B');

  -- 2 · Loja do Cidadão --------------------------------------------------------
  insert into public.checkpoints (event_id, seq, name, theme, description, challenge, text_prompt, lat, lng)
  values (v_event, 2, 'Loja do Cidadão', 'Participação cívica',
    'Espaço onde se tratam documentos e assuntos com vários serviços públicos. Lembrem-se: aqui há pessoas a ser atendidas, por isso falem baixo.',
    'Fotografem a sinalética do átrio e indiquem 3 serviços e quando é que um jovem precisa de cada um.',
    'Indiquem 3 serviços e quando é que um jovem precisa de cada um.',
    40.6387, -8.6393)
  returning id into v_cp;
  insert into public.quiz_questions (checkpoint_id, question, options) values (v_cp,
    'O que é a Loja do Cidadão?',
    '{"A":"Uma loja de produtos tradicionais","B":"Um espaço que reúne vários serviços públicos num só local","C":"A sede da Junta de Freguesia","D":"Um centro comercial municipal"}');
  insert into private.quiz_keys (checkpoint_id, correct_option) values (v_cp, 'B');

  -- 3 · Parque Infante D. Pedro ------------------------------------------------
  insert into public.checkpoints (event_id, seq, name, theme, description, challenge, text_prompt, lat, lng)
  values (v_event, 3, 'Parque Infante D. Pedro', 'Ambiente',
    'Um dos principais espaços verdes da cidade, com lago, árvores antigas e zonas de lazer.',
    'Fotografem os resíduos que recolheram depositados no contentor certo e um problema ambiental visível no parque, com uma proposta de solução.',
    'Que problema ambiental encontraram e que solução propõem?',
    40.6364, -8.6531)
  returning id into v_cp;
  insert into public.quiz_questions (checkpoint_id, question, options) values (v_cp,
    'Em que ecoponto se deposita uma garrafa de vidro?',
    '{"A":"Azul","B":"Amarelo","C":"Verde","D":"Vermelho"}');
  insert into private.quiz_keys (checkpoint_id, correct_option) values (v_cp, 'C');

  -- 4 · Museu de Aveiro --------------------------------------------------------
  insert into public.checkpoints (event_id, seq, name, theme, description, challenge, text_prompt, lat, lng)
  values (v_event, 4, 'Museu de Aveiro (antigo Convento de Jesus)', 'Património',
    'O museu ocupa o antigo Convento de Jesus, um dos edifícios históricos mais importantes da cidade.',
    'Fotografem uma placa ou painel informativo do edifício e escrevam porque é importante preservá-lo.',
    'Porque é importante preservar este edifício?',
    40.6393, -8.6509)
  returning id into v_cp;
  insert into public.quiz_questions (checkpoint_id, question, options) values (v_cp,
    'O antigo Convento de Jesus está ligado a que figura histórica?',
    '{"A":"Rainha Santa Isabel","B":"Princesa Santa Joana, filha de D. Afonso V","C":"Infante D. Henrique","D":"D. Maria II"}');
  insert into private.quiz_keys (checkpoint_id, correct_option) values (v_cp, 'B');

  -- 5 · Câmara Municipal e Biblioteca ------------------------------------------
  insert into public.checkpoints (event_id, seq, name, theme, description, challenge, text_prompt, lat, lng)
  values (v_event, 5, 'Câmara Municipal e Biblioteca (Praça da República)', 'Participação cívica',
    'Na Praça da República fica a Câmara Municipal, onde se decide a vida da cidade. A Biblioteca Municipal oferece serviços a todos os cidadãos.',
    'Fotografem a placa da estátua da Praça da República (quem homenageia) e indiquem 2 serviços gratuitos da Biblioteca úteis a estudantes.',
    'Quem homenageia a estátua e que 2 serviços gratuitos da Biblioteca são úteis a estudantes?',
    40.6405, -8.6538)
  returning id into v_cp;
  insert into public.quiz_questions (checkpoint_id, question, options) values (v_cp,
    'Com que idade se pode votar nas eleições autárquicas?',
    '{"A":"16","B":"17","C":"18","D":"21"}');
  insert into private.quiz_keys (checkpoint_id, correct_option) values (v_cp, 'C');

  -- 6 · Canal Central e Largo do Rossio ----------------------------------------
  insert into public.checkpoints (event_id, seq, name, theme, description, challenge, text_prompt, lat, lng)
  values (v_event, 6, 'Canal Central e Largo do Rossio', 'Inclusão e património',
    'O coração da cidade, junto à Ria, com os barcos tradicionais e muito movimento de pessoas.',
    'Fotografem um obstáculo à passagem de uma cadeira de rodas e uma boa prática de acessibilidade, propondo uma melhoria.',
    'Que melhoria de acessibilidade propõem?',
    40.6415, -8.6566)
  returning id into v_cp;
  insert into public.quiz_questions (checkpoint_id, question, options) values (v_cp,
    'Como se chamam os barcos tradicionais da Ria usados para apanhar o moliço?',
    '{"A":"Gôndolas","B":"Moliceiros","C":"Caravelas","D":"Rabelos"}');
  insert into private.quiz_keys (checkpoint_id, correct_option) values (v_cp, 'B');

  -- 7 · Mercado Manuel Firmino -------------------------------------------------
  insert into public.checkpoints (event_id, seq, name, theme, description, challenge, text_prompt, lat, lng)
  values (v_event, 7, 'Mercado Manuel Firmino', 'Ambiente e consumo local',
    'Mercado municipal onde produtores e comerciantes vendem produtos frescos da região.',
    'Fotografem 3 produtos locais ou da época e um produto vendido sem embalagem.',
    'Que produtos locais ou da época encontraram?',
    40.6418, -8.6486)
  returning id into v_cp;
  insert into public.quiz_questions (checkpoint_id, question, options) values (v_cp,
    'Porque é mais sustentável comprar produtos locais e da época?',
    '{"A":"São sempre mais baratos","B":"Reduz o transporte e as emissões e apoia os produtores da região","C":"Têm mais embalagens","D":"Duram mais no frigorífico"}');
  insert into private.quiz_keys (checkpoint_id, correct_option) values (v_cp, 'B');

  -- Equipas de teste (postos iniciais espaçados: 1, 4, 6) ----------------------
  insert into public.teams (event_id, name, class_name, code, start_seq) values
    (v_event, 'Equipa Teste 1', 'TDS Teste', 'EPA-TST1', 1),
    (v_event, 'Equipa Teste 2', 'TDS Teste', 'EPA-TST2', 4),
    (v_event, 'Equipa Teste 3', 'TDS Teste', 'EPA-TST3', 6);
end
$seed$;
