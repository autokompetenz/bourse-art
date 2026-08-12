import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://bourse-art.vercel.app";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

  const smtpHost = Deno.env.get("SMTP_HOST") ?? "smtp.hostinger.com";
  const smtpPort = Number(Deno.env.get("SMTP_PORT") ?? "465");
  const smtpUser = Deno.env.get("SMTP_USER");
  const smtpPassword = Deno.env.get("SMTP_PASSWORD");
  const smtpFrom = Deno.env.get("SMTP_FROM") ?? smtpUser;

  if (!supabaseUrl || !serviceRoleKey || !anonKey || !smtpUser || !smtpPassword) {
    return json({ ok: false, error: "Configuration du serveur incomplète (clés SMTP manquantes)." }, 500);
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "Méthode non autorisée." }, 405);
  }

  try {
    const body = await req.json().catch(() => null);
    const email = body?.email;
    if (!email) {
      return json({ ok: false, error: "Paramètre email requis." }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ ok: false, error: "Non authentifié." }, 401);
    }

    const anonClient = createClient(supabaseUrl, anonKey);
    const { data: authData, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !authData.user) {
      return json({ ok: false, error: "Non authentifié." }, 401);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminClient
      .from("users")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (!profile || profile.role !== "admin") {
      return json({ ok: false, error: "Accès refusé : réservé à l'administrateur." }, 403);
    }

    const { data: pending, error: pendingError } = await adminClient
      .from("pending_users")
      .select("name, email")
      .eq("email", email)
      .maybeSingle();
    if (pendingError || !pending) {
      return json({ ok: false, error: "Aucun compte en attente pour cet email." }, 404);
    }

    const signupUrl = `${SITE_URL}/connexion`;

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPassword,
        },
      },
    });

    try {
      await client.send({
        from: smtpFrom ?? smtpUser,
        to: [pending.email],
        subject: "Votre compte artiste Bourse&Art a été créé",
        content: `Bonjour ${pending.name},
Votre compte artiste Bourse&Art a été créé par l'administrateur.
Pour l'activer, définissez votre mot de passe en vous rendant sur la page de connexion et en choisissant l'onglet « Inscription ».

${signupUrl}

L'équipe Bourse&Art`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#132853;">
            <h1 style="font-size:22px;margin:0 0 16px;">Bienvenue chez Bourse&Art</h1>
            <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">
              Bonjour ${pending.name}, votre compte artiste a été créé par l'administrateur.
            </p>
            <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">
              Pour l'activer, choisissez votre mot de passe via l'onglet
              <strong>« Inscription »</strong> de la page de connexion.
            </p>
            <a href="${signupUrl}"
               style="display:inline-block;background:#C9A84C;color:#ffffff;text-decoration:none;
                      padding:12px 20px;border-radius:8px;font-size:15px;">
              Définir mon mot de passe
            </a>
            <p style="font-size:13px;color:#6b6b70;margin:24px 0 0;">
              L'équipe Bourse&Art — Cette notification est automatique, merci de ne pas y répondre.
            </p>
          </div>
        `,
      });
    } finally {
      try {
        await client.close();
      } catch {
        // La fermeture de la connexion peut échouer si le serveur a déjà coupé.
      }
    }

    return json({ ok: true, to: pending.email });
  } catch (err) {
    return json({ ok: false, error: `Échec de l'envoi du mail : ${err instanceof Error ? err.message : "erreur inconnue"}` }, 500);
  }
});
