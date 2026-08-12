import { supabase, supabaseConfig } from "./supabase";

export type EmailResult = {
  status: "sent" | "skipped" | "error";
  detail?: string;
};

/**
 * Notifie par email l'artiste dont le tableau vient d'être vendu.
 * Côté Supabase, l'envoi passe par l'Edge Function `notify-artist-sale`
 * (Resend). En mode démo (Supabase non configuré), aucun email réel n'est envoyé.
 */
export async function notifyArtistOfSale(artworkId: string): Promise<EmailResult> {
  if (!supabaseConfig.configured) {
    return {
      status: "skipped",
      detail: "Mode démo actif : aucun email réel n'est envoyé.",
    };
  }
  try {
    const { error } = await supabase.functions.invoke("notify-artist-sale", {
      body: { artworkId },
    });
    if (error) {
      return { status: "error", detail: error.message };
    }
    return { status: "sent" };
  } catch (err) {
    return {
      status: "error",
      detail: err instanceof Error ? err.message : "Erreur inattendue.",
    };
  }
}

/**
 * Envoie au client un email d'invitation après la création de son compte
 * par l'admin (il définit lui-même son mot de passe à l'inscription).
 */
export async function notifyPendingArtist(email: string): Promise<EmailResult> {
  if (!supabaseConfig.configured) {
    return {
      status: "skipped",
      detail: "Mode démo actif : aucun email réel n'est envoyé.",
    };
  }
  try {
    const { error } = await supabase.functions.invoke("notify-pending-artist", {
      body: { email },
    });
    if (error) {
      return { status: "error", detail: error.message };
    }
    return { status: "sent" };
  } catch (err) {
    return {
      status: "error",
      detail: err instanceof Error ? err.message : "Erreur inattendue.",
    };
  }
}
