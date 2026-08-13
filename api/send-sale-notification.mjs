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

function formatChf(value) {
  if (value == null) return "—";
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
  }).format(Number(value));
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
    const artworkId =
      typeof req.body?.artworkId === "string" ? req.body.artworkId.trim() : "";
    if (!artworkId) {
      return sendJson(res, 400, { ok: false, error: "Paramètre artworkId requis." });
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

    const { data: artwork, error: artError } = await adminClient
      .from("artworks")
      .select("title, price, buyer_name, negotiation_date, artists:users(name, email)")
      .eq("id", artworkId)
      .maybeSingle();
    if (artError || !artwork) {
      return sendJson(res, 404, { ok: false, error: "Tableau introuvable." });
    }

    const artistEmail = artwork.artists?.email;
    const artistName = artwork.artists?.name ?? "Artiste";
    if (!artistEmail) {
      return sendJson(res, 404, { ok: false, error: "Adresse email de l'artiste introuvable." });
    }

    const buyerName = artwork.buyer_name ?? "Un acheteur";
    const saleDate = artwork.negotiation_date
      ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
          new Date(artwork.negotiation_date)
        )
      : "récemment";

    const { createTransport } = await import("nodemailer");
    const transporter = createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPassword },
    });

    const titleHtml = escapeHtml(artwork.title);
    const nameHtml = escapeHtml(artistName);
    const emailHtml = escapeHtml(artistEmail);

    await transporter.sendMail({
      from: smtpFrom,
      to: artistEmail,
      subject: `Votre tableau « ${artwork.title} » a été vendu`,
      text: `Bonjour ${artistName},
Votre tableau « ${artwork.title} » a été vendu à ${buyerName} le ${saleDate} au prix de ${formatChf(artwork.price)}.
Le montant a été crédité sur votre solde. Vous pouvez suivre vos ventes depuis votre espace artiste.

L'équipe Bourse&Art`,
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#132853;">
          <h1 style="font-size:22px;margin:0 0 16px;">Félicitations !</h1>
          <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">
            Bonjour <strong>${nameHtml}</strong>, votre tableau
            <strong>« ${titleHtml} »</strong> a été vendu à ${escapeHtml(buyerName)}
            le ${saleDate} au prix de <strong>${formatChf(artwork.price)}</strong>.
          </p>
          <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">
            Le montant a été crédité sur votre solde. Vous pouvez suivre vos ventes
            et vos retraits depuis votre espace artiste.
          </p>
          <a href="${siteUrl}/artiste"
             style="display:inline-block;background:#C9A84C;color:#ffffff;text-decoration:none;
                    padding:12px 20px;border-radius:8px;font-size:15px;">
            Accéder à mon espace
          </a>
          <p style="font-size:13px;color:#6b6b70;margin:24px 0 0;">
            L'équipe Bourse&Art — Cette notification est automatique, merci de ne pas y répondre.
          </p>
        </div>
      `,
    });

    return sendJson(res, 200, { ok: true, to: artistEmail });
  } catch (err) {
    return sendJson(res, 500, {
      ok: false,
      error: `Échec de l'envoi du mail : ${err instanceof Error ? err.message : "erreur inconnue"}`,
    });
  }
}
