import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function formatChf(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("fr-CH", {
    style: "currency",
    currency: "CHF",
  }).format(Number(value));
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
    const artworkId = body?.artworkId;
    if (!artworkId) {
      return json({ ok: false, error: "Paramètre artworkId requis." }, 400);
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

    const { data: artwork, error: artError } = await adminClient
      .from("artworks")
      .select("title, price, buyer_name, negotiation_date, artists:users(name, email)")
      .eq("id", artworkId)
      .maybeSingle();
    if (artError || !artwork) {
      return json({ ok: false, error: "Tableau introuvable." }, 404);
    }

    const artistEmail = artwork.artists?.email;
    const artistName = artwork.artists?.name ?? "Artiste";
    if (!artistEmail) {
      return json({ ok: false, error: "Adresse email de l'artiste introuvable." }, 404);
    }

    const buyerName = artwork.buyer_name ?? "Un acheteur";
    const saleDate = artwork.negotiation_date
      ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
          new Date(artwork.negotiation_date)
        )
      : "récemment";

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
        to: [artistEmail],
        subject: `Votre tableau « ${artwork.title} » a été vendu`,
        content: `Bonjour ${artistName},
Votre tableau « ${artwork.title} » a été vendu à ${buyerName} le ${saleDate} au prix de ${formatChf(artwork.price)}.
Le montant a été crédité sur votre solde. Vous pouvez suivre vos ventes depuis votre espace artiste.

L'équipe Bourse&Art`,
        html: `
          <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#132853;">
            <h1 style="font-size:22px;margin:0 0 16px;">Félicitations !</h1>
            <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">
              Bonjour ${artistName}, votre tableau <strong>« ${artwork.title} »</strong>
              a été vendu à ${buyerName} le ${saleDate} au prix de
              <strong>${formatChf(artwork.price)}</strong>.
            </p>
            <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">
              Le montant a été crédité sur votre solde. Vous pouvez suivre vos ventes
              et vos retraits depuis votre espace artiste.
            </p>
            <a href="https://bourse-art.vercel.app/artiste"
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
    } finally {
      try {
        await client.close();
      } catch {
        // La fermeture de la connexion peut échouer si le serveur a déjà coupé.
      }
    }

    return json({ ok: true, to: artistEmail });
  } catch (err) {
    return json({ ok: false, error: `Échec de l'envoi du mail : ${err instanceof Error ? err.message : "erreur inconnue"}` }, 500);
  }
});
