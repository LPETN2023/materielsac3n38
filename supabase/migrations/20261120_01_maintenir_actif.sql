-- Fonction appelée tous les 3 jours par GitHub Actions (.github/workflows/maintenir-actif.yml)
-- pour éviter la mise en pause du projet Supabase gratuit (7 jours sans activité).
-- Elle ne lit aucune table et ne renvoie que l'heure du serveur.
create or replace function public.maintenir_actif()
returns timestamptz language sql stable security invoker set search_path = '' as $$ select now() $$;
revoke all on function public.maintenir_actif() from public;
grant execute on function public.maintenir_actif() to anon, authenticated;
