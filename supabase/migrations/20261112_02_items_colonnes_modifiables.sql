-- ============================================================
-- 2026-11-12 : colonnes de items modifiables depuis le navigateur
-- (correctif piste 1 de l'audit de sécurité audit-1)
--  - Avant : tout compte actif pouvait modifier status, qr_code, created_by,
--    created_by_name, created_at et id via l'API, sans passer par l'interface.
--  - Après : seules les colonnes descriptives sont modifiables.
--    Le statut ne change que par preter_objet / rendre_objet (SECURITY DEFINER).
--    Le QR code se choisit à la création et ne change plus ensuite.
-- ============================================================

revoke insert, update on public.items from authenticated;

grant insert (qr_code, type, brand, model, description, storage_location, is_loanable)
  on public.items to authenticated;

grant update (type, brand, model, description, storage_location, is_loanable)
  on public.items to authenticated;
