import { supabaseConfig } from "./supabase";
import { getValidAccessToken } from "./auth";

export type EmailResult = {
  status: "sent" | "skipped" | "error";
  detail?: string;
};

/**
 * Notifie par email l'artiste dont le tableau vient d'être vendu.
 * L'envoi passe par la fonction serverless Vercel
 * `/api/send-sale-notification` (SMTP, même infrastructure que le mail de
 * bienvenue). En mode démo (Supabase non configuré), aucun email réel n'est
 * envoyé.
 */
export async function notifyArtistOfSale(artworkId: string): Promise<EmailResult> {
  if (!supabaseConfig.configured) {
    return {
      status: "skipped",
      detail: "Mode démo actif : aucun email réel n'est envoyé.",
    };
  }
  const accessToken = await getValidAccessToken();
  if (!accessToken) {
    return {
      status: "error",
      detail:
        "L'email de notification n'a pas pu être envoyé : session expirée, reconnectez-vous puis réessayez.",
    };
  }
  try {
    const res = await fetch("/api/send-sale-notification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ artworkId }),
    });
    const payload = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;
    if (res.ok && payload?.ok) {
      return { status: "sent" };
    }
    const apiError = payload?.error ?? `Erreur serveur (${res.status})`;
    return {
      status: "error",
      detail: `L'email de notification n'a pas pu être envoyé : ${apiError}. Vérifiez que vous testez sur le site en ligne (l'API d'envoi n'existe qu'en production).`,
    };
  } catch (err) {
    return {
      status: "error",
      detail: `L'email de notification n'a pas pu être envoyé : ${err instanceof Error ? err.message : "erreur inconnue"}. Vérifiez que vous testez sur le site en ligne.`,
    };
  }
}
