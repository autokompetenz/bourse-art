import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", CORS_HEADERS["Access-Control-Allow-Origin"]);
  res.setHeader("Access-Control-Allow-Headers", CORS_HEADERS["Access-Control-Allow-Headers"]);
  res.setHeader("Access-Control-Allow-Methods", CORS_HEADERS["Access-Control-Allow-Methods"]);
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const smtpHost = process.env.SMTP_HOST ?? "smtp.hostinger.com";
  const smtpPort = Number(process.env.SMTP_PORT ?? "465");
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM ?? smtpUser;
  const siteUrl = (process.env.SITE_URL ?? "https://www.boursemarket.business").replace(/\/+$/, "");

  if (!supabaseUrl || !serviceRoleKey || !smtpUser || !smtpPassword) {
    return res
      .status(500)
      .json({ ok: false, error: "Configuration serveur incomplète (SMTP ou clé service role manquants)." });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Méthode non autorisée." });
  }

  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email) {
      return res.status(400).json({ ok: false, error: "Paramètre email requis." });
    }

    // Vérification : seul un admin connecté peut déclencher l'envoi.
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, error: "Non authentifié." });
    }
    const accessToken = authHeader.slice("Bearer ".length);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
    if (authError || !authData?.user) {
      return res.status(401).json({ ok: false, error: "Non authentifié." });
    }
    const { data: profile } = await adminClient
      .from("users")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (!profile || profile.role !== "admin") {
      return res.status(403).json({ ok: false, error: "Accès refusé : réservé à l'administrateur." });
    }

    const { data: pending } = await adminClient
      .from("pending_users")
      .select("name, email")
      .ilike("email", email)
      .maybeSingle();
    const artistName = pending?.name ?? "Artiste";

    // Magic link Supabase : le lien de confirmation pointe vers SITE_URL
    // (jamais localhost) car le redirect est généré côté serveur.
    const redirectTo = `${siteUrl}/connexion?activation=1`;
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo, shouldSendEmail: false },
    });
    const magicLink = linkData?.properties?.action_link;
    if (linkError || !magicLink) {
      return res.status(500).json({
        ok: false,
        error: `Impossible de générer le lien de connexion : ${linkError?.message ?? "erreur inconnue"}`,
      });
    }

    const { createTransport } = await import("nodemailer");
    const transporter = createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPassword },
    });

    const nameHtml = escapeHtml(artistName);
    const emailHtml = escapeHtml(email);
    const magicLinkHtml = escapeHtml(magicLink);

    await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject: "Bienvenue sur Bourse&Art",
      text: `Bonjour ${artistName},

Bienvenue sur Bourse&Art !

Votre compte a été créé par l'administrateur pour exposer vos œuvres d'art sur notre plateforme boursière.

Pour activer votre espace artiste, cliquez sur le lien ci-dessous puis choisissez votre mot de passe :

${magicLink}

Ce lien est valable 24 heures. Une fois activé, vous pourrez vous connecter avec votre adresse email (${email}) et suivre la cotation de vos œuvres, vos ventes et vos retraits.

L'équipe Bourse&Art`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#132853;">
          <h1 style="font-size:22px;margin:0 0 16px;">Bienvenue sur Bourse&Art !</h1>
          <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">
            Bonjour <strong>${nameHtml}</strong>,
          </p>
          <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">
            Votre compte a été créé par l'administrateur pour exposer vos
            <strong>œuvres d'art</strong> sur notre plateforme boursière.
          </p>
          <p style="font-size:16px;line-height:1.6;margin:0 0 20px;">
            Pour activer votre espace artiste, cliquez sur le bouton ci-dessous
            puis choisissez votre mot de passe :
          </p>
          <a href="${magicLinkHtml}"
             style="display:inline-block;background:#C9A84C;color:#ffffff;text-decoration:none;
                    padding:14px 24px;border-radius:8px;font-size:16px;font-weight:bold;">
            Activer mon espace artiste
          </a>
          <p style="font-size:13px;color:#6b6b70;margin:20px 0 0;line-height:1.5;">
            Ce lien est valable 24 heures. Une fois activé, connectez-vous avec
            <strong>${emailHtml}</strong> pour suivre la cotation de vos œuvres,
            vos ventes et vos retraits.
          </p>
          <p style="font-size:13px;color:#6b6b70;margin:24px 0 0;">
            L'équipe Bourse&Art — Cet email est automatique, merci de ne pas y répondre.
          </p>
        </div>
      `,
    });

    return res.status(200).json({ ok: true, to: email });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: `Échec de l'envoi du mail : ${err instanceof Error ? err.message : "erreur inconnue"}` });
  }
}
