import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabaseConfig = {
  configured: Boolean(supabaseUrl && supabaseAnonKey),
};

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(
      supabaseUrl || "https://placeholder.supabase.co",
      supabaseAnonKey || "placeholder-anon-key"
    );
  }
  return client;
}

/**
 * Client créé paresseusement : tant que Supabase n'est pas configuré,
 * aucune connexion (ni realtime) n'est initialisée.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop: string | symbol, receiver) {
    const value = Reflect.get(getClient(), prop, receiver);
    return typeof value === "function" ? value.bind(getClient()) : value;
  },
});
