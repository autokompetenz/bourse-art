import { createClient } from "@supabase/supabase-js";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export default async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const smtpHost = process.env.SMTP_HOST ?? "smtp.hostinger.com";
  const smtpPort = Number(process.env.SMTP_PORT ?? "465");
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM ?? smtpUser;
  const siteUrl = (process.env.SITE_URL ?? "https://www.boursemarket.business").replace(/\/+$/, "");

  if (!supabaseUrl || !serviceRoleKey || !smtpUser || !smtpPassword) {
    return sendJson(res, 500, {
      ok: false,
      error: "Configuration serveur incomplète (SMTP ou clé service role manquants).",
    });
  }
  if (req.method !== "POST") {
    return sendJson(res, 405, { ok: false, error: "Méthode non autorisée." });
  }

  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email) {
      return sendJson(res, 400, { ok: false, error: "Paramètre email requis." });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return sendJson(res, 401, { ok: false, error: "Non authentifié." });
    }
    const accessToken = authHeader.slice("Bearer ".length);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: authData, error: authError } = await adminClient.auth.getUser(accessToken);
    if (authError || !authData?.user) {
      return sendJson(res, 401, { ok: false, error: "Non authentifié." });
    }
    const { data: profile } = await adminClient
      .from("users")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (!profile || profile.role !== "admin") {
      return sendJson(res, 403, { ok: false, error: "Accès refusé : réservé à l'administrateur." });
    }

    const { data: artistProfile } = await adminClient
      .from("users")
      .select("name")
      .ilike("email", email)
      .maybeSingle();
    const artistName = artistProfile?.name ?? "Artiste";

    // Lien de récupération (type recovery) : l'artiste clique, définit son
    // mot de passe, puis se connecte en email + mot de passe. Le redirect
    // pointe vers SITE_URL (jamais localhost) : généré côté serveur.
    const redirectTo = `${siteUrl}/connexion?activation=1`;
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo, shouldSendEmail: false },
    });
    const magicLink = linkData?.properties?.action_link;
    if (linkError || !magicLink) {
      return sendJson(res, 500, {
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
    const magicLinkHtml = escapeHtml(magicLink);

    await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject: "Bienvenue sur Bourse&Art",
      text: `Bonjour ${artistName},

Bienvenue sur Bourse&Art !

Votre compte a été créé par Bourse&Art pour exposer vos œuvres d'art sur notre plateforme boursière.

Pour activer votre compte, choisissez votre mot de passe via le lien ci-dessous :

${magicLink}

Connectez-vous ensuite sur ${siteUrl}/connexion avec votre email et votre mot de passe pour suivre la cotation de vos œuvres, vos ventes et vos retraits.

Ce lien est valable quelques heures.

L'équipe Bourse&Art`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#132853;">
          <h1 style="font-size:22px;margin:0 0 16px;">Bienvenue sur Bourse&Art !</h1>
          <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">
            Bonjour <strong>${nameHtml}</strong>,
          </p>
          <p style="font-size:16px;line-height:1.6;margin:0 0 20px;">
            Votre compte a été créé par Bourse&Art pour exposer vos
            <strong>œuvres d'art</strong> sur notre plateforme boursière.
          </p>
          <p style="font-size:16px;line-height:1.6;margin:0 0 8px;">
            Pour activer votre compte, choisissez votre mot de passe :
          </p>
          <a href="${magicLinkHtml}"
             style="display:inline-block;background:#C9A84C;color:#ffffff;text-decoration:none;
                    padding:14px 24px;border-radius:8px;font-size:16px;font-weight:bold;">
            Choisir mon mot de passe
          </a>
          <p style="font-size:16px;line-height:1.6;margin:20px 0 0;">
            Connectez-vous ensuite sur
            <a href="${siteUrl}/connexion" style="color:#C9A84C;">${siteUrl}/connexion</a>
            avec votre email et votre mot de passe pour suivre la cotation de vos
            œuvres, vos ventes et vos retraits.
          </p>
          <p style="font-size:13px;color:#6b6b70;margin:20px 0 0;line-height:1.5;">
            Ce lien est valable quelques heures.
          </p>
          <p style="font-size:13px;color:#6b6b70;margin:24px 0 0;">
            L'équipe Bourse&Art — Cet email est automatique, merci de ne pas y répondre.
          </p>
        </div>
      `,
    });

    return sendJson(res, 200, { ok: true, to: email });
  } catch (err) {
    return sendJson(res, 500, {
      ok: false,
      error: `Échec de l'envoi du mail : ${err instanceof Error ? err.message : "erreur inconnue"}`,
    });
  }
}
