import type { User as AuthUser } from "@supabase/supabase-js";
import { supabase, supabaseConfig } from "./supabase";

export type Role = "admin" | "artist";

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type AuthResult =
  | { ok: true; user: Profile }
  | { ok: false; error: string };

const DEMO_SESSION_KEY = "bourse_demo_session";
const DEMO_USERS_KEY = "bourse_demo_users";

type DemoUser = Profile & { password: string | null };

const SEED_DEMO_USERS: DemoUser[] = [
  { id: "demo-admin", name: "Admin", email: "admin@bourse.com", password: "admin123", role: "admin" },
  { id: "demo-artist", name: "Artiste Démo", email: "artiste@demo.com", password: "artist123", role: "artist" },
];

export function isConfigured(): boolean {
  return supabaseConfig.configured;
}

function readDemoUsers(): DemoUser[] {
  try {
    const raw = localStorage.getItem(DEMO_USERS_KEY);
    const extra: DemoUser[] = raw ? (JSON.parse(raw) as DemoUser[]) : [];
    return [...SEED_DEMO_USERS, ...extra];
  } catch {
    return SEED_DEMO_USERS;
  }
}

async function resolveProfile(authUser: AuthUser): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, email, role")
    .eq("id", authUser.id)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, name: data.name, email: data.email, role: data.role };
}

function profileFromAuthUser(authUser: AuthUser): Profile {
  const meta = (authUser.user_metadata ?? {}) as { name?: string; role?: Role };
  return {
    id: authUser.id,
    name: meta.name || authUser.email?.split("@")[0] || "Utilisateur",
    email: authUser.email ?? "",
    role: meta.role === "admin" ? "admin" : "artist",
  };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!isConfigured()) {
    const normalized = email.trim().toLowerCase();
    const demo = readDemoUsers().find(
      (u) => u.email === normalized && u.password === password
    );
    if (demo) {
      const { password: _ignored, ...user } = demo;
      localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
      return { ok: true, user };
    }
    const pending = readDemoUsers().find(
      (u) => u.email === normalized && u.password === null
    );
    if (pending) {
      return {
        ok: false,
        error: "Votre compte est en attente : définissez votre mot de passe à l'inscription.",
      };
    }
    return { ok: false, error: "Email ou mot de passe incorrect." };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message || "Identifiants incorrects." };
  }
  const user = (await resolveProfile(data.user)) ?? profileFromAuthUser(data.user);
  return { ok: true, user };
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(DEMO_SESSION_KEY);
  if (isConfigured()) await supabase.auth.signOut();
}

export async function getSession(): Promise<Profile | null> {
  if (!isConfigured()) {
    try {
      const raw = localStorage.getItem(DEMO_SESSION_KEY);
      return raw ? (JSON.parse(raw) as Profile) : null;
    } catch {
      return null;
    }
  }
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) return null;
  return (await resolveProfile(data.session.user)) ?? profileFromAuthUser(data.session.user);
}

export function onAuthStateChange(cb: (user: Profile | null) => void): () => void {
  if (!isConfigured()) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const authUser = session?.user;
    if (!authUser) {
      cb(null);
      return;
    }
    void (async () => {
      cb((await resolveProfile(authUser)) ?? profileFromAuthUser(authUser));
    })();
  });
  return () => data.subscription.unsubscribe();
}

export function getDemoUsers(): Profile[] {
  return readDemoUsers()
    .filter((u) => u.password)
    .map(({ password: _ignored, ...user }) => user);
}

export function demoCreateArtist(name: string, email: string): boolean {
  if (isConfigured()) return false;
  const users = readDemoUsers();
  const emailNormalized = email.trim().toLowerCase();
  if (users.some((u) => u.email === emailNormalized)) return false;
  const newUser: DemoUser = {
    id: `demo-${Date.now()}`,
    name: name.trim(),
    email: emailNormalized,
    password: null,
    role: "artist",
  };
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify([...users, newUser]));
  return true;
}

export function demoActivateArtist(email: string, password: string): boolean {
  if (isConfigured()) return false;
  const users = readDemoUsers();
  const user = users.find(
    (u) => u.email === email.trim().toLowerCase() && u.password === null
  );
  if (!user) return false;
  const next = users.map((u) => (u.id === user.id ? { ...u, password } : u));
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(next));
  return true;
}

export function demoDeleteArtist(id: string): boolean {
  if (isConfigured()) return false;
  const users = readDemoUsers();
  const user = users.find((u) => u.id === id && u.role === "artist");
  if (!user) return false;
  localStorage.setItem(
    DEMO_USERS_KEY,
    JSON.stringify(users.filter((u) => u.id !== id))
  );
  return true;
}

/**
 * Envoie le mail d'accueil personnalisé (SMTP Hostinger via la fonction
 * serverless Vercel `/api/send-welcome-email`). Le lien de confirmation
 * pointe vers SITE_URL (jamais localhost). En cas d'échec (dev local sans
 * API, API non déployée), on retombe sur le mail Magic Link de Supabase.
 */
export async function sendActivationLink(
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isConfigured()) {
    return { ok: false, error: "Mode démo actif : aucun email réel n'est envoyé." };
  }
  const normalized = email.trim().toLowerCase();

  try {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    const res = await fetch("/api/send-welcome-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ email: normalized }),
    });
    const payload = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (res.ok && payload?.ok) {
      return { ok: true };
    }
    const apiError = payload?.error ?? `Erreur serveur (${res.status})`;
    const fallback = await sendViaSupabaseMagicLink(normalized);
    return fallback.ok
      ? { ok: true }
      : { ok: false, error: `${apiError}. Repli Supabase : ${fallback.error}` };
  } catch (err) {
    const fallback = await sendViaSupabaseMagicLink(normalized);
    if (fallback.ok) return { ok: true };
    return {
      ok: false,
      error: `Mail non envoyé : ${err instanceof Error ? err.message : "erreur inconnue"}. ${fallback.error}`,
    };
  }
}

async function sendViaSupabaseMagicLink(
  email: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const redirectTo = `${appOrigin()}/connexion?activation=1`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo,
    },
  });
  if (error) {
    return {
      ok: false,
      error: error.message || "erreur inconnue",
    };
  }
  return { ok: true };
}

/**
 * Origine publique du site pour les liens d'activation.
 * En production (VITE_SITE_URL renseigné), le lien n'est jamais localhost,
 * même dans le repli Supabase Magic Link.
 */
function appOrigin(): string {
  const configured = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  if (configured && !/localhost|127\.0\.0\.1|:\d+$/.test(configured)) {
    return configured.replace(/\/+$/, "");
  }
  return window.location.origin;
}

/** Définit le mot de passe du client connecté (après magic link). */
export async function setOwnPassword(
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isConfigured()) {
    return { ok: false, error: "Mode démo actif : connexion Supabase requise." };
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export type DemoArtistAccount = {
  id: string;
  name: string;
  email: string;
  role: Role;
  pending: boolean;
  created_at: string;
  artworks_count: number;
};

export function getDemoArtists(): DemoArtistAccount[] {
  return readDemoUsers()
    .filter((u) => u.role === "artist")
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      pending: !u.password,
      created_at: "",
      artworks_count: 0,
    }));
}
