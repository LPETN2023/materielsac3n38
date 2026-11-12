-- ============================================================
-- SCHÉMA COMPLET - Gestion de Matériels (état au 12/11/2026)
-- Pour une INSTALLATION NEUVE uniquement : Supabase > SQL Editor > Run.
-- La base en service a été mise à niveau par supabase/migrations/.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ---------- Tables ----------
create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  username    text        not null unique,
  full_name   text        not null,
  role        text        not null default 'user' check (role in ('admin', 'user')),
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.item_types (
  id          uuid        primary key default uuid_generate_v4(),
  name        text        not null unique,
  code        varchar(8),
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.items (
  id                uuid        primary key default uuid_generate_v4(),
  qr_code           text        not null unique,
  type              text        not null,
  brand             text,
  model             text,
  description       text,
  storage_location  text,
  status            text        not null default 'available' check (status in ('available', 'loaned')),
  is_loanable       boolean     not null default true,
  created_by        uuid        references public.profiles(id) on delete set null,
  created_by_name   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.loans (
  id                   uuid        primary key default uuid_generate_v4(),
  item_id              uuid        not null references public.items(id) on delete cascade,
  loaned_to            text        not null,
  loan_date            date        not null default current_date,
  expected_return_date date,
  operation            text,
  notes                text,
  returned_at          timestamptz,
  return_notes         text,
  returned_by          uuid        references public.profiles(id) on delete set null,
  returned_by_name     text,
  created_by           uuid        references public.profiles(id) on delete set null,
  created_by_name      text,
  created_at           timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id           uuid        primary key default uuid_generate_v4(),
  user_id      uuid        references public.profiles(id) on delete set null,
  username     text,
  action       text        not null,
  entity_type  text,
  entity_id    text,
  details      jsonb,
  ip_address   text,
  created_at   timestamptz not null default now()
);

create table if not exists public.known_persons (
  id           uuid        primary key default uuid_generate_v4(),
  name         text        not null unique,
  usage_count  integer     not null default 1,
  created_at   timestamptz not null default now()
);

create table if not exists public.operations (
  id           uuid        primary key default uuid_generate_v4(),
  name         text        not null unique,
  usage_count  integer     not null default 1,
  created_at   timestamptz not null default now()
);

alter table public.profiles      enable row level security;
alter table public.item_types    enable row level security;
alter table public.items         enable row level security;
alter table public.loans         enable row level security;
alter table public.audit_logs    enable row level security;
alter table public.known_persons enable row level security;
alter table public.operations    enable row level security;

revoke all on all tables in schema public from anon;
revoke truncate, trigger, references on all tables in schema public from authenticated;

-- ---------- Fonctions utilitaires ----------
create or replace function public.update_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
                 where id = (select auth.uid()) and is_active);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles
                 where id = (select auth.uid()) and is_active and role = 'admin');
$$;

create or replace function public.current_user_name()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select full_name from public.profiles where id = (select auth.uid())),
    (select email from auth.users where id = (select auth.uid())),
    'Inconnu');
$$;

revoke execute on function public.is_active_user(), public.is_admin(), public.current_user_name() from public, anon;
grant  execute on function public.is_active_user(), public.is_admin(), public.current_user_name() to authenticated;

-- ---------- Index ----------
create unique index if not exists loans_un_pret_actif on public.loans (item_id) where returned_at is null;
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- ---------- Règles RLS (on repart de zéro) ----------
do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- profiles : on voit toujours son propre profil (pour détecter un compte désactivé)
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_active_user()));
create policy profiles_update on public.profiles for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
-- pas d'INSERT ni de DELETE : création via l'Edge Function "creer-compte"

-- item_types : gérés par tous les comptes actifs
create policy item_types_select on public.item_types for select to authenticated using ((select public.is_active_user()));
create policy item_types_insert on public.item_types for insert to authenticated with check ((select public.is_active_user()));
create policy item_types_update on public.item_types for update to authenticated using ((select public.is_active_user())) with check ((select public.is_active_user()));
create policy item_types_delete on public.item_types for delete to authenticated using ((select public.is_active_user()));

-- items : suppression réservée aux admins
create policy items_select on public.items for select to authenticated using ((select public.is_active_user()));
create policy items_insert on public.items for insert to authenticated with check ((select public.is_active_user()));
create policy items_update on public.items for update to authenticated using ((select public.is_active_user())) with check ((select public.is_active_user()));
create policy items_delete on public.items for delete to authenticated using ((select public.is_admin()));
-- items : seules les colonnes descriptives sont modifiables depuis le navigateur
-- (status : uniquement preter_objet / rendre_objet ; qr_code : fixé à la création)
revoke insert, update on public.items from authenticated;
grant insert (qr_code, type, brand, model, description, storage_location, is_loanable) on public.items to authenticated;
grant update (type, brand, model, description, storage_location, is_loanable) on public.items to authenticated;

-- loans : lecture seule ; écriture via preter_objet / rendre_objet
create policy loans_select on public.loans for select to authenticated using ((select public.is_active_user()));

-- autocomplétion : lecture seule ; alimentée par preter_objet
create policy persons_select on public.known_persons for select to authenticated using ((select public.is_active_user()));
create policy operations_select on public.operations for select to authenticated using ((select public.is_active_user()));

-- audit_logs : lecture admin ; le navigateur ne peut écrire que connexion / déconnexion / mot de passe
create policy audit_select on public.audit_logs for select to authenticated using ((select public.is_admin()));
create policy audit_insert on public.audit_logs for insert to authenticated
  with check ((select public.is_active_user()) and action in ('LOGIN', 'LOGOUT', 'PASSWORD_CHANGE'));

-- ---------- Triggers ----------
-- audit_logs : auteur, nom et date imposés par la base
create or replace function public.audit_imposer_auteur()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    new.user_id  := (select auth.uid());
    new.username := public.current_user_name();
  end if;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists trg_audit_auteur on public.audit_logs;
create trigger trg_audit_auteur before insert on public.audit_logs
  for each row execute function public.audit_imposer_auteur();

-- items : créateur imposé
create or replace function public.items_imposer_createur()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    new.created_by      := (select auth.uid());
    new.created_by_name := public.current_user_name();
  end if;
  new.created_at := now();
  return new;
end $$;
drop trigger if exists trg_items_createur on public.items;
create trigger trg_items_createur before insert on public.items
  for each row execute function public.items_imposer_createur();

-- profiles : un admin ne peut ni se rétrograder ni se désactiver, l'identifiant ne change pas
create or replace function public.profiles_proteger()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.username <> old.username or new.created_at <> old.created_at then
    raise exception 'Modification non autorisée' using errcode = '42501';
  end if;
  if old.id = (select auth.uid()) and (new.role <> old.role or new.is_active <> old.is_active) then
    raise exception 'Vous ne pouvez pas modifier votre propre rôle ou statut' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_proteger on public.profiles;
create trigger trg_profiles_proteger before update on public.profiles
  for each row execute function public.profiles_proteger();

-- journal automatique
create or replace function public.journaliser()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_action text; v_type text; v_id text; v_details jsonb := '{}'::jsonb;
  v_qr text; k text;
begin
  if tg_table_name = 'items' then
    v_type := 'item';
    if tg_op = 'INSERT' then
      v_action := 'ITEM_CREATE'; v_id := new.id::text;
      v_details := jsonb_build_object('qr_code', new.qr_code, 'type', new.type);
    elsif tg_op = 'UPDATE' then
      -- changement de statut fait par preter_objet / rendre_objet : déjà journalisé
      if current_setting('app.pret_en_cours', true) = '1' then return null; end if;
      v_action := 'ITEM_UPDATE'; v_id := new.id::text;
      v_details := jsonb_build_object('qr_code', new.qr_code);
      for k in select key from jsonb_each(to_jsonb(new)) loop
        if k not in ('updated_at') and (to_jsonb(new) -> k) is distinct from (to_jsonb(old) -> k) then
          v_details := v_details || jsonb_build_object(k, to_jsonb(new) ->> k);
        end if;
      end loop;
      if v_details = jsonb_build_object('qr_code', new.qr_code) then return null; end if;
    else
      v_action := 'ITEM_DELETE'; v_id := old.id::text;
      v_details := jsonb_build_object('qr_code', old.qr_code, 'type', old.type);
    end if;
  elsif tg_table_name = 'loans' then
    v_type := 'loan';
    if tg_op = 'INSERT' then
      select qr_code into v_qr from public.items where id = new.item_id;
      v_action := 'LOAN_CREATE'; v_id := new.id::text;
      v_details := jsonb_build_object('qr_code', v_qr, 'prete_a', new.loaned_to);
    elsif tg_op = 'UPDATE' and old.returned_at is null and new.returned_at is not null then
      select qr_code into v_qr from public.items where id = new.item_id;
      v_action := 'LOAN_RETURN'; v_id := new.id::text;
      v_details := jsonb_build_object('qr_code', v_qr, 'prete_a', new.loaned_to);
    else
      return null;
    end if;
  elsif tg_table_name = 'item_types' then
    v_type := 'item_type';
    if tg_op = 'INSERT' then v_action := 'ITEMTYPE_CREATE'; v_id := new.id::text;
      v_details := jsonb_build_object('nom', new.name, 'code', new.code);
    elsif tg_op = 'UPDATE' then v_action := 'ITEMTYPE_UPDATE'; v_id := new.id::text;
      v_details := jsonb_build_object('nom', new.name, 'code', new.code);
    else v_action := 'ITEMTYPE_DELETE'; v_id := old.id::text;
      v_details := jsonb_build_object('nom', old.name, 'code', old.code);
    end if;
  elsif tg_table_name = 'profiles' then
    v_type := 'user'; v_id := new.id::text;
    if new.role is distinct from old.role then
      insert into public.audit_logs (action, entity_type, entity_id, details)
      values ('USER_ROLE_CHANGE', v_type, v_id, jsonb_build_object('compte', new.full_name, 'role', new.role));
    end if;
    if new.is_active is distinct from old.is_active then
      insert into public.audit_logs (action, entity_type, entity_id, details)
      values (case when new.is_active then 'USER_ACTIVATE' else 'USER_DEACTIVATE' end, v_type, v_id,
              jsonb_build_object('compte', new.full_name));
    end if;
    return null;
  end if;

  insert into public.audit_logs (action, entity_type, entity_id, details)
  values (v_action, v_type, v_id, v_details);
  return null;
end $$;

drop trigger if exists trg_journal_items on public.items;
create trigger trg_journal_items after insert or update or delete on public.items
  for each row execute function public.journaliser();
drop trigger if exists trg_journal_loans on public.loans;
create trigger trg_journal_loans after insert or update on public.loans
  for each row execute function public.journaliser();
drop trigger if exists trg_journal_item_types on public.item_types;
create trigger trg_journal_item_types after insert or update or delete on public.item_types
  for each row execute function public.journaliser();
drop trigger if exists trg_journal_profiles on public.profiles;
create trigger trg_journal_profiles after update on public.profiles
  for each row execute function public.journaliser();

revoke execute on function public.journaliser(), public.audit_imposer_auteur(),
  public.items_imposer_createur(), public.profiles_proteger() from public, anon, authenticated;

-- ---------- Prêt / retour atomiques ----------
create or replace function public.preter_objet(
  p_item_id uuid, p_loaned_to text, p_loan_date date default current_date,
  p_expected_return date default null, p_operation text default null, p_notes text default null)
returns public.loans language plpgsql security definer set search_path = '' as $$
declare
  v_item public.items; v_loan public.loans;
  v_to text := nullif(btrim(p_loaned_to), '');
  v_op text := nullif(btrim(p_operation), '');
begin
  if not public.is_active_user() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if v_to is null then raise exception 'Le destinataire est obligatoire'; end if;

  select * into v_item from public.items where id = p_item_id for update;
  if not found then raise exception 'Objet introuvable'; end if;
  if v_item.status <> 'available' or exists (
       select 1 from public.loans where item_id = p_item_id and returned_at is null) then
    raise exception 'Cet objet est déjà prêté';
  end if;

  perform set_config('app.pret_en_cours', '1', true);

  insert into public.loans (item_id, loaned_to, loan_date, expected_return_date, operation, notes,
                            created_by, created_by_name)
  values (p_item_id, v_to, coalesce(p_loan_date, current_date), p_expected_return, v_op,
          nullif(btrim(p_notes), ''), (select auth.uid()), public.current_user_name())
  returning * into v_loan;

  update public.items set status = 'loaned' where id = p_item_id;

  insert into public.known_persons (name, usage_count) values (v_to, 1)
  on conflict (name) do update set usage_count = public.known_persons.usage_count + 1;
  if v_op is not null then
    insert into public.operations (name, usage_count) values (v_op, 1)
    on conflict (name) do update set usage_count = public.operations.usage_count + 1;
  end if;

  perform set_config('app.pret_en_cours', '', true);
  return v_loan;
end $$;

create or replace function public.rendre_objet(p_loan_id uuid, p_return_notes text default null)
returns public.loans language plpgsql security definer set search_path = '' as $$
declare v_loan public.loans;
begin
  if not public.is_active_user() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  select * into v_loan from public.loans where id = p_loan_id for update;
  if not found then raise exception 'Prêt introuvable'; end if;
  if v_loan.returned_at is not null then raise exception 'Cet objet a déjà été restitué'; end if;

  perform set_config('app.pret_en_cours', '1', true);

  update public.loans
     set returned_at = now(), return_notes = nullif(btrim(p_return_notes), ''),
         returned_by = (select auth.uid()), returned_by_name = public.current_user_name()
   where id = p_loan_id
  returning * into v_loan;

  update public.items set status = 'available' where id = v_loan.item_id;

  perform set_config('app.pret_en_cours', '', true);
  return v_loan;
end $$;

revoke execute on function public.preter_objet(uuid, text, date, date, text, text),
                           public.rendre_objet(uuid, text) from public, anon;
grant  execute on function public.preter_objet(uuid, text, date, date, text, text),
                           public.rendre_objet(uuid, text) to authenticated;

create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.update_updated_at();
create trigger trg_items_updated_at before update on public.items
  for each row execute function public.update_updated_at();

-- ============================================================
-- APRÈS INSTALLATION
-- 1. Déployer l'Edge Function supabase/functions/creer-compte
--    (Supabase > Edge Functions, « Verify JWT » activé).
-- 2. Authentication > Sign In / Providers : désactiver « Allow new users to sign up »
--    et « Confirm email ».
-- 3. Créer le premier admin : Authentication > Users > Add user (email du domaine),
--    puis en SQL :
--    insert into public.profiles (id, username, full_name, role)
--    values ('UUID_DU_COMPTE', 'prenom.nom', 'Prénom NOM', 'admin');
-- 4. Les comptes suivants se créent depuis la page « Comptes » du site.
-- ============================================================
