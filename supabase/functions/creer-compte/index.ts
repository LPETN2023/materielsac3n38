// ============================================================
// Edge Function « creer-compte »
// Crée un compte (auth + profil) à la demande d'un ADMIN actif.
// La clé service_role reste côté serveur (variable d'environnement
// fournie automatiquement par Supabase) : elle n'est jamais dans le site.
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const DOMAINE = "@gendarmerie.interieur.gouv.fr";
const ORIGINES = ["https://lpetn2023.github.io", "http://localhost:8000", "http://127.0.0.1:8000"];

function entetes(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGINES.includes(origin) ? origin : ORIGINES[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

function reponse(req: Request, status: number, corps: Record<string, unknown>) {
  return new Response(JSON.stringify(corps), { status, headers: entetes(req) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: entetes(req) });
  if (req.method !== "POST") return reponse(req, 405, { error: "Méthode non autorisée" });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Qui appelle ?
    const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!jeton) return reponse(req, 401, { error: "Non connecté" });
    const appelant = createClient(url, anon, { auth: { persistSession: false } });
    const { data: { user }, error: errUser } = await appelant.auth.getUser(jeton);
    if (errUser || !user) return reponse(req, 401, { error: "Session invalide" });

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: profil } = await admin.from("profiles")
      .select("full_name, role, is_active").eq("id", user.id).maybeSingle();
    if (!profil || profil.role !== "admin" || !profil.is_active) {
      return reponse(req, 403, { error: "Réservé aux administrateurs" });
    }

    // 2. Contrôle des données
    const corps = await req.json().catch(() => ({}));
    const email = String(corps.email ?? "").trim().toLowerCase();
    const motDePasse = String(corps.password ?? "");
    const nom = String(corps.full_name ?? "").trim();
    const role = corps.role === "admin" ? "admin" : "user";

    if (!email.endsWith(DOMAINE) || email.length <= DOMAINE.length) {
      return reponse(req, 400, { error: `Seuls les emails ${DOMAINE} sont autorisés` });
    }
    if (!nom) return reponse(req, 400, { error: "Le nom est obligatoire" });
    if (motDePasse.length < 6) return reponse(req, 400, { error: "Mot de passe trop court (min. 6 caractères)" });

    // 3. Création du compte (email confirmé d'office)
    const { data: cree, error: errCreation } = await admin.auth.admin.createUser({
      email, password: motDePasse, email_confirm: true, user_metadata: { full_name: nom },
    });
    if (errCreation || !cree.user) {
      const deja = /already|registered|exists/i.test(errCreation?.message ?? "");
      return reponse(req, deja ? 409 : 400, {
        error: deja ? "Cet email est déjà utilisé" : `Création impossible : ${errCreation?.message}`,
      });
    }

    // 4. Profil (annulation du compte en cas d'échec)
    const { error: errProfil } = await admin.from("profiles").insert({
      id: cree.user.id, username: email.split("@")[0], full_name: nom, role, is_active: true,
    });
    if (errProfil) {
      await admin.auth.admin.deleteUser(cree.user.id);
      const doublon = errProfil.code === "23505";
      return reponse(req, doublon ? 409 : 500, {
        error: doublon ? "Cet identifiant existe déjà" : `Profil non enregistré : ${errProfil.message}`,
      });
    }

    // 5. Journal
    await admin.from("audit_logs").insert({
      user_id: user.id, username: profil.full_name, action: "USER_CREATE",
      entity_type: "user", entity_id: cree.user.id, details: { email, role },
    });

    return reponse(req, 200, { id: cree.user.id });
  } catch (e) {
    return reponse(req, 500, { error: `Erreur serveur : ${(e as Error).message}` });
  }
});
