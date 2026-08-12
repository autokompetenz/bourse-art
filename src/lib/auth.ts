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

type DemoUser = Profile & { password: string };

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
    const demo = readDemoUsers().find(
      (u) => u.email === email.trim().toLowerCase() && u.password === password
    );
    if (!demo) return { ok: false, error: "Email ou mot de passe incorrect." };
    const { password: _ignored, ...user } = demo;
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
    return { ok: true, user };
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
  return readDemoUsers().map(({ password: _ignored, ...user }) => user);
}

export function demoCreateArtist(name: string, email: string, password: string): boolean {
  if (isConfigured()) return false;
  const users = readDemoUsers();
  const emailNormalized = email.trim().toLowerCase();
  if (users.some((u) => u.email === emailNormalized)) return false;
  const newUser: DemoUser = {
    id: `demo-${Date.now()}`,
    name: name.trim(),
    email: emailNormalized,
    password,
    role: "artist",
  };
  localStorage.setItem(DEMO_USERS_KEY, JSON.stringify([...users, newUser]));
  return true;
}
