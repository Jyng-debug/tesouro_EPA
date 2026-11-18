-- =============================================================================
-- Tesouro EPA — Fase 1: Storage (bucket privado "photos") e Realtime
-- =============================================================================
-- Caminho das fotos: <event_id>/<team_id>/<checkpoint_id>/<timestamp>.jpg
-- * Cada equipa só carrega e vê fotos na pasta da sua equipa.
-- * Professores veem todas (via signed URLs). Só o admin apaga.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy photos_team_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = (select private.my_event_id())::text
    and (storage.foldername(name))[2] = (select private.my_team_id())::text
    and array_length(storage.foldername(name), 1) = 3
  );

create policy photos_select on storage.objects for select to authenticated
  using (
    bucket_id = 'photos'
    and (
      (select private.is_staff())
      or (storage.foldername(name))[2] = (select private.my_team_id())::text
    )
  );

create policy photos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (select private.is_admin()));

-- Realtime: o painel dos professores e a app das equipas recebem alterações em
-- tempo real. O RLS aplica-se: cada equipa só recebe eventos das suas linhas.
alter publication supabase_realtime add table
  public.submissions,
  public.quiz_answers,
  public.adjustments,
  public.teams,
  public.team_members,
  public.photo_votes;
