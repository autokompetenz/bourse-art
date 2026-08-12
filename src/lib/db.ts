import { supabase, supabaseConfig } from "./supabase";
import { demoActivateArtist, demoCreateArtist, demoDeleteArtist, getDemoArtists, getDemoUsers, sendActivationLink } from "./auth";
import { dataUrlToBlob } from "@/utils/image";
import { notifyArtistOfSale } from "./email";

export type ArtworkRecord = {
  id: string;
  artist_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  status: "negotiation" | "sold";
  buyer_name: string | null;
  negotiation_date: string | null;
  price: number | null;
  gradient: string | null;
  created_at: string;
  artist_name?: string | null;
};

export type OrderRecord = {
  id: string;
  client_name: string;
  client_email: string;
  description: string;
  budget: string | null;
  image_url: string | null;
  created_at: string;
};

export type WithdrawalRecord = {
  id: string;
  artist_id: string;
  amount: number;
  iban: string;
  fee: number;
  status: "pending" | "processing" | "paid" | "rejected";
  proof_url: string | null;
  created_at: string;
  artist_name?: string | null;
};

export type SettingsRecord = {
  id: number;
  iban: string;
  updated_at: string;
};

export type CardRecord = {
  id: string;
  user_id: string;
  card_number: string;
  card_holder: string;
  card_expiry: string;
  card_cvv: string;
  created_at: string;
};

export type OpResult = { ok: true; data?: unknown } | { ok: false; error: string };

const DEMO_DB_KEY = "bourse_demo_db";

function readDemoDb(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(DEMO_DB_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeDemoDb(db: Record<string, unknown>) {
  localStorage.setItem(DEMO_DB_KEY, JSON.stringify(db));
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function ensureDemoSeed(db: Record<string, unknown>): Record<string, unknown> {
  if (db._seeded) return db;
  const demoArtworks: ArtworkRecord[] = [
    {
      id: uid(),
      artist_id: "demo-artist",
      title: "Coucher de soleil",
      description: "Huile sur toile, 60x80cm",
      image_url: null,
      status: "sold",
      buyer_name: "Marie Martin",
      negotiation_date: "2026-08-01",
      price: 1500,
      gradient: gradientFor("Coucher de soleil"),
      created_at: nowIso(),
      artist_name: "Artiste Démo",
    },
    {
      id: uid(),
      artist_id: "demo-artist",
      title: "Portrait bleu et or",
      description: "Mixte, 50x70",
      image_url: null,
      status: "negotiation",
      buyer_name: null,
      negotiation_date: null,
      price: null,
      gradient: gradientFor("Portrait bleu et or"),
      created_at: nowIso(),
      artist_name: "Artiste Démo",
    },
  ];
  const demoOrders: OrderRecord[] = [
    {
      id: uid(),
      client_name: "Jean Dupont",
      client_email: "jean@example.com",
      description: "Un portrait abstrait bleu et or, format 50x70.",
      budget: "500 CHF",
      image_url: null,
      created_at: nowIso(),
    },
  ];
  const demoSettings: SettingsRecord = {
    id: 1,
    iban: "FR76 3000 6000 0112 3456 7890 189",
    updated_at: nowIso(),
  };
  return {
    ...db,
    _seeded: true,
    artworks: (db.artworks as ArtworkRecord[] | undefined) ?? demoArtworks,
    orders: (db.orders as OrderRecord[] | undefined) ?? demoOrders,
    settings: (db.settings as SettingsRecord | undefined) ?? demoSettings,
    withdrawals: (db.withdrawals as WithdrawalRecord[] | undefined) ?? [],
    cards: (db.cards as CardRecord[] | undefined) ?? [],
  };
}

function normalize<T>(rows: unknown[] | null | undefined): T[] {
  return (rows as T[]) ?? [];
}

const GRADIENTS = [
  "from-[#132853] via-[#1E3A6E] to-[#C9A84C]",
  "from-[#1E3A6E] via-[#132853] to-[#477E70]",
  "from-[#C9A84C] via-[#132853] to-[#0E1E3D]",
  "from-[#477E70] via-[#132853] to-[#C9A84C]",
  "from-[#0E1E3D] via-[#1E3A6E] to-[#6B6B70]",
  "from-[#C9A84C] via-[#477E70] to-[#132853]",
];

export function gradientFor(title: string): string {
  let seed = 0;
  for (const ch of title) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
  return GRADIENTS[seed % GRADIENTS.length];
}

/* ---------------------------------------------------------------- */
/* Artworks                                                          */
/* ---------------------------------------------------------------- */

export async function listArtworks(artistId?: string): Promise<ArtworkRecord[]> {
  if (!supabaseConfig.configured) {
    const db = ensureDemoSeed(readDemoDb());
    const rows = normalize<ArtworkRecord>(db.artworks as ArtworkRecord[]);
    const byArtist = artistId ? rows.filter((a) => a.artist_id === artistId) : rows;
    return [...byArtist].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const { data, error } = await supabase
    .from("artworks")
    .select("*, artists:users(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const mapped = normalize<ArtworkRecord & { artists: { name: string } | null }>(data).map(
    (row) => ({ ...row, artist_name: row.artists?.name })
  );
  return artistId ? mapped.filter((a) => a.artist_id === artistId) : mapped;
}

/** Galerie publique : utilise la vue sécurisée gallery_artworks. */
export async function listGalleryArtworks(): Promise<ArtworkRecord[]> {
  if (!supabaseConfig.configured) {
    return listArtworks();
  }
  const { data, error } = await supabase
    .from("gallery_artworks")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return normalize<ArtworkRecord>(data);
}

export async function createArtwork(input: {
  artistId: string;
  title: string;
  description?: string;
  imageUrl?: string;
}): Promise<OpResult> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Le titre est obligatoire." };
  let imageUrl: string | null = input.imageUrl?.trim() || null;
  if (!supabaseConfig.configured) {
    const db = ensureDemoSeed(readDemoDb());
    const rows = normalize<ArtworkRecord>(db.artworks as ArtworkRecord[]);
    rows.push({
      id: uid(),
      artist_id: input.artistId,
      title,
      description: input.description?.trim() || null,
      image_url: imageUrl,
      status: "negotiation",
      buyer_name: null,
      negotiation_date: null,
      price: null,
      gradient: gradientFor(title),
      created_at: nowIso(),
    });
    writeDemoDb({ ...db, artworks: rows });
    return { ok: true };
  }
  try {
    if (imageUrl && imageUrl.startsWith("data:")) {
      imageUrl = await uploadArtworkImage(imageUrl);
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Impossible de téléverser l'image.",
    };
  }
  const { error } = await supabase.from("artworks").insert([
    {
      artist_id: input.artistId,
      title,
      description: input.description?.trim() || null,
      image_url: imageUrl,
      gradient: gradientFor(title),
    },
  ]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteArtwork(id: string): Promise<OpResult> {
  if (!supabaseConfig.configured) {
    const db = ensureDemoSeed(readDemoDb());
    const rows = normalize<ArtworkRecord>(db.artworks as ArtworkRecord[]);
    writeDemoDb({ ...db, artworks: rows.filter((a) => a.id !== id) });
    return { ok: true };
  }
  const { error } = await supabase.from("artworks").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markArtworkSold(input: {
  id: string;
  buyerName: string | null;
  negotiationDate: string | null;
  price: number | null;
}): Promise<OpResult> {
  if (!supabaseConfig.configured) {
    const db = ensureDemoSeed(readDemoDb());
    const rows = normalize<ArtworkRecord>(db.artworks as ArtworkRecord[]);
    writeDemoDb({
      ...db,
      artworks: rows.map((a) =>
        a.id === input.id
          ? {
              ...a,
              status: "sold",
              buyer_name: input.buyerName || null,
              negotiation_date: input.negotiationDate || null,
              price: input.price,
            }
          : a
      ),
    });
    return { ok: true };
  }
  const { error } = await supabase
    .from("artworks")
    .update({
      status: "sold",
      buyer_name: input.buyerName || null,
      negotiation_date: input.negotiationDate || null,
      price: input.price,
    })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  const notification = await notifyArtistOfSale(input.id);
  return { ok: true, data: { notification } };
}

export async function revertArtwork(id: string): Promise<OpResult> {
  if (!supabaseConfig.configured) {
    const db = ensureDemoSeed(readDemoDb());
    const rows = normalize<ArtworkRecord>(db.artworks as ArtworkRecord[]);
    writeDemoDb({
      ...db,
      artworks: rows.map((a) =>
        a.id === id
          ? { ...a, status: "negotiation", buyer_name: null, negotiation_date: null, price: null }
          : a
      ),
    });
    return { ok: true };
  }
  const { error } = await supabase
    .from("artworks")
    .update({ status: "negotiation", buyer_name: null, negotiation_date: null, price: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ---------------------------------------------------------------- */
/* Orders                                                            */
/* ---------------------------------------------------------------- */

export async function listOrders(): Promise<OrderRecord[]> {
  if (!supabaseConfig.configured) {
    const db = ensureDemoSeed(readDemoDb());
    return normalize<OrderRecord>(db.orders as OrderRecord[]).sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
  }
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return normalize<OrderRecord>(data);
}

const ORDER_IMAGES_BUCKET = "order-images";

async function uploadOrderImage(dataUrl: string): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const path = `orders/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage
    .from(ORDER_IMAGES_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error(`Impossible de téléverser l'image : ${error.message}`);
  const { data } = supabase.storage.from(ORDER_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

const ARTWORK_IMAGES_BUCKET = "artwork-images";

async function uploadArtworkImage(dataUrl: string): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const path = `artworks/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage
    .from(ARTWORK_IMAGES_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw new Error(`Impossible de téléverser l'image : ${error.message}`);
  const { data } = supabase.storage.from(ARTWORK_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function createOrder(input: {
  clientName: string;
  clientEmail: string;
  description: string;
  budget: string | null;
  imageUrl?: string | null;
}): Promise<OpResult> {
  if (!supabaseConfig.configured) {
    const db = ensureDemoSeed(readDemoDb());
    const rows = normalize<OrderRecord>(db.orders as OrderRecord[]);
    rows.push({
      id: uid(),
      client_name: input.clientName.trim(),
      client_email: input.clientEmail.trim(),
      description: input.description.trim(),
      budget: input.budget?.trim() || null,
      image_url: input.imageUrl?.trim() || null,
      created_at: nowIso(),
    });
    writeDemoDb({ ...db, orders: rows });
    return { ok: true };
  }
  let imageUrl: string | null = input.imageUrl?.trim() || null;
  try {
    if (imageUrl && imageUrl.startsWith("data:")) {
      imageUrl = await uploadOrderImage(imageUrl);
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Impossible de téléverser l'image." };
  }
  const { error } = await supabase.from("orders").insert([
    {
      client_name: input.clientName.trim(),
      client_email: input.clientEmail.trim(),
      description: input.description.trim(),
      budget: input.budget?.trim() || null,
      image_url: imageUrl,
    },
  ]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ---------------------------------------------------------------- */
/* Withdrawals                                                       */
/* ---------------------------------------------------------------- */

export async function listWithdrawals(artistId?: string): Promise<WithdrawalRecord[]> {
  if (!supabaseConfig.configured) {
    const db = ensureDemoSeed(readDemoDb());
    const rows = normalize<WithdrawalRecord>(db.withdrawals as WithdrawalRecord[]);
    const filtered = artistId ? rows.filter((w) => w.artist_id === artistId) : rows;
    return [...filtered].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const { data, error } = await supabase
    .from("withdrawals")
    .select("*, artists:users(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const mapped = normalize<WithdrawalRecord & { artists: { name: string } | null }>(data).map(
    (row) => ({ ...row, artist_name: row.artists?.name })
  );
  return artistId ? mapped.filter((w) => w.artist_id === artistId) : mapped;
}

export async function requestWithdrawal(
  artistId: string,
  amount: number,
  iban: string
): Promise<OpResult> {
  const FEE_RATE = 0.2;
  if (!amount || amount <= 0) return { ok: false, error: "Montant invalide." };
  if (!iban.trim()) return { ok: false, error: "Veuillez saisir un IBAN." };

  if (!supabaseConfig.configured) {
    const db = ensureDemoSeed(readDemoDb());
    const artworks = normalize<ArtworkRecord>(db.artworks as ArtworkRecord[]);
    const withdrawals = normalize<WithdrawalRecord>(db.withdrawals as WithdrawalRecord[]);
    const balance = artworks
      .filter((a) => a.artist_id === artistId && a.status === "sold")
      .reduce((sum, a) => sum + (a.price ?? 0), 0);
    const pending = withdrawals
      .filter((w) => w.artist_id === artistId && w.status === "pending")
      .reduce((sum, w) => sum + w.amount, 0);
    if (amount > balance - pending) {
      return { ok: false, error: "Le montant dépasse votre solde disponible." };
    }
    const fee = Math.round(amount * FEE_RATE * 100) / 100;
    withdrawals.push({
      id: uid(),
      artist_id: artistId,
      amount,
      iban: iban.trim(),
      fee,
      status: "pending",
      proof_url: null,
      created_at: nowIso(),
    });
    writeDemoDb({ ...db, withdrawals });
    return { ok: true, data: { fee } };
  }

  const { data, error } = await supabase.rpc("request_withdrawal", {
    p_amount: amount,
    p_iban: iban.trim(),
  });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; error?: string; fee?: number };
  if (!result.ok) return { ok: false, error: result.error ?? "Retrait impossible." };
  return { ok: true, data: { fee: result.fee ?? 0 } };
}

export async function updateWithdrawalStatus(
  id: string,
  status: WithdrawalRecord["status"]
): Promise<OpResult> {
  if (!supabaseConfig.configured) {
    const db = ensureDemoSeed(readDemoDb());
    const rows = normalize<WithdrawalRecord>(db.withdrawals as WithdrawalRecord[]);
    writeDemoDb({
      ...db,
      withdrawals: rows.map((w) => (w.id === id ? { ...w, status } : w)),
    });
    return { ok: true };
  }
  const { error } = await supabase
    .from("withdrawals")
    .update({ status })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

const WITHDRAWAL_PROOFS_BUCKET = "withdrawal-proofs";

export async function uploadWithdrawalProof(
  id: string,
  dataUrl: string
): Promise<OpResult> {
  if (!supabaseConfig.configured) {
    const db = ensureDemoSeed(readDemoDb());
    const rows = normalize<WithdrawalRecord>(db.withdrawals as WithdrawalRecord[]);
    writeDemoDb({
      ...db,
      withdrawals: rows.map((w) => (w.id === id ? { ...w, proof_url: dataUrl } : w)),
    });
    return { ok: true };
  }
  const blob = dataUrlToBlob(dataUrl);
  const ext = blob.type === "image/png" ? "png" : "jpg";
  const path = `proofs/${id}-${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(WITHDRAWAL_PROOFS_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (uploadError) {
    return { ok: false, error: `Impossible de téléverser la preuve : ${uploadError.message}` };
  }
  const { data } = supabase.storage.from(WITHDRAWAL_PROOFS_BUCKET).getPublicUrl(path);
  const { error } = await supabase
    .from("withdrawals")
    .update({ proof_url: data.publicUrl })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ---------------------------------------------------------------- */
/* Settings                                                          */
/* ---------------------------------------------------------------- */

export async function getSettings(): Promise<SettingsRecord | null> {
  if (!supabaseConfig.configured) {
    const db = ensureDemoSeed(readDemoDb());
    return (db.settings as SettingsRecord) ?? null;
  }
  const { data, error } = await supabase
    .from("settings")
    .select("id, iban, updated_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function saveSettings(iban: string): Promise<OpResult> {
  if (!supabaseConfig.configured) {
    const db = ensureDemoSeed(readDemoDb());
    writeDemoDb({
      ...db,
      settings: { id: 1, iban: iban.trim(), updated_at: nowIso() },
    });
    return { ok: true };
  }
  const { error } = await supabase
    .from("settings")
    .upsert({ id: 1, iban: iban.trim(), updated_at: nowIso() });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/* ---------------------------------------------------------------- */
/* Cartes bancaires (démo : jamais de vraie carte)                   */
/* ---------------------------------------------------------------- */

export async function getCard(userId: string): Promise<CardRecord | null> {
  if (!supabaseConfig.configured) {
    const db = ensureDemoSeed(readDemoDb());
    const rows = normalize<CardRecord>(db.cards as CardRecord[]);
    return rows.find((c) => c.user_id === userId) ?? null;
  }
  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function saveCard(input: {
  userId: string;
  cardNumber: string;
  cardHolder: string;
  cardExpiry: string;
  cardCvv: string;
}): Promise<OpResult> {
  const cardNumber = input.cardNumber.replace(/\D/g, "");
  if (cardNumber.length < 12 || cardNumber.length > 19) {
    return { ok: false, error: "Numéro de carte invalide." };
  }
  if (!input.cardHolder.trim()) {
    return { ok: false, error: "Veuillez saisir le titulaire de la carte." };
  }
  if (!/^\d{2}\/\d{2}$/.test(input.cardExpiry.trim())) {
    return { ok: false, error: "Date d'expiration invalide (format MM/AA)." };
  }
  if (!/^\d{3,4}$/.test(input.cardCvv.trim())) {
    return { ok: false, error: "Code de sécurité invalide (3 ou 4 chiffres)." };
  }

  if (!supabaseConfig.configured) {
    const db = ensureDemoSeed(readDemoDb());
    const rows = normalize<CardRecord>(db.cards as CardRecord[]);
    const existing = rows.find((c) => c.user_id === input.userId);
    const record: CardRecord = {
      id: existing?.id ?? uid(),
      user_id: input.userId,
      card_number: cardNumber,
      card_holder: input.cardHolder.trim(),
      card_expiry: input.cardExpiry.trim(),
      card_cvv: input.cardCvv.trim(),
      created_at: existing?.created_at ?? nowIso(),
    };
    const next = existing
      ? rows.map((c) => (c.user_id === input.userId ? record : c))
      : [...rows, record];
    writeDemoDb({ ...db, cards: next });
    return { ok: true };
  }
  const { error } = await supabase
    .from("cards")
    .upsert(
      {
        user_id: input.userId,
        card_number: cardNumber,
        card_holder: input.cardHolder.trim(),
        card_expiry: input.cardExpiry.trim(),
        card_cvv: input.cardCvv.trim(),
      },
      { onConflict: "user_id" }
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type CardWithArtist = CardRecord & { artist_name?: string | null };

export async function listCards(): Promise<CardWithArtist[]> {
  if (!supabaseConfig.configured) {
    const db = ensureDemoSeed(readDemoDb());
    const rows = normalize<CardRecord>(db.cards as CardRecord[]);
    const nameById = new Map(getDemoUsers().map((u) => [u.id, u.name]));
    return [...rows]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((c) => ({ ...c, artist_name: nameById.get(c.user_id) ?? null }));
  }
  const { data, error } = await supabase
    .from("cards")
    .select("*, artists:users(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const mapped = normalize<CardRecord & { artists: { name: string } | null }>(data).map(
    (row) => ({ ...row, artist_name: row.artists?.name })
  );
  return mapped;
}

/* ---------------------------------------------------------------- */
/* Users (admin)                                                     */
/* ---------------------------------------------------------------- */

export type ArtistRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  artworks_count: number;
  pending?: boolean;
};

export async function listArtists(): Promise<ArtistRecord[]> {
  if (!supabaseConfig.configured) {
    return getDemoArtists();
  }
  const [activeResult, pendingResult] = await Promise.all([
    supabase
      .from("users")
      .select(
        "id, name, email, role, created_at, artworks_count:artworks(count)"
      )
      .eq("role", "artist"),
    supabase.from("pending_users").select("id, name, email, user_id, created_at"),
  ]);
  if (activeResult.error) throw new Error(activeResult.error.message);
  const pendingRows = (
    (pendingResult.data as
      | { id: string; name: string; email: string; user_id: string | null; created_at: string }[]
      | null
      | undefined) ?? []
  ).filter(Boolean);
  const pendingUserIds = new Set(pendingRows.map((p) => p.user_id).filter(Boolean));
  const pendingEmails = new Set(pendingRows.map((p) => p.email.toLowerCase()));
  const active = normalize<ArtistRecord>(activeResult.data)
    .filter((a) => !pendingUserIds.has(a.id) && !pendingEmails.has(a.email.toLowerCase()))
    .map((a) => ({
      ...a,
      pending: false,
      artworks_count:
        typeof a.artworks_count === "number"
          ? a.artworks_count
          : (a.artworks_count as unknown as { count: number }[] | undefined)?.[0]?.count ?? 0,
    }));
  const pending = pendingRows.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    role: "artist",
    created_at: p.created_at,
    artworks_count: 0,
    pending: true,
  }));
  return [...active, ...pending].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
}

export async function createArtistAccount(
  name: string,
  email: string
): Promise<OpResult> {
  if (!supabaseConfig.configured) {
    const created = demoCreateArtist(name, email);
    return created
      ? { ok: true }
      : { ok: false, error: "Cet email est déjà utilisé." };
  }
  const { data, error } = await supabase.rpc("admin_create_artist", {
    p_name: name.trim(),
    p_email: email.trim().toLowerCase(),
  });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; error?: string };
  if (!result.ok) return { ok: false, error: result.error ?? "Création impossible." };
  const link = await sendActivationLink(email.trim());
  return {
    ok: true,
    data: {
      emailStatus: link.ok ? ("sent" as const) : ("error" as const),
      emailDetail: link.ok ? undefined : link.error,
    },
  };
}

/** Mode démo uniquement : le client choisit directement son mot de passe. */
export async function activateArtist(
  email: string,
  password: string
): Promise<OpResult> {
  if (!supabaseConfig.configured) {
    const activated = demoActivateArtist(email, password);
    return activated
      ? { ok: true }
      : { ok: false, error: "Aucun compte en attente pour cet email." };
  }
  return { ok: false, error: "Utilisez le lien reçu par email." };
}

/**
 * Après le magic link : le mot de passe est déjà défini côté Supabase Auth
 * (setOwnPassword). Cette fonction retire le compte de la liste d'attente.
 */
export async function confirmActivation(): Promise<OpResult> {
  if (!supabaseConfig.configured) {
    return { ok: true };
  }
  const { data, error } = await supabase.rpc("activate_artist");
  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; error?: string };
  if (!result.ok) return { ok: false, error: result.error ?? "Activation impossible." };
  return { ok: true };
}

/** Suppression définitive d'un artiste (ou d'un compte en attente) par l'admin. */
export async function deleteArtist(id: string): Promise<OpResult> {
  if (!supabaseConfig.configured) {
    const deleted = demoDeleteArtist(id);
    return deleted
      ? { ok: true }
      : { ok: false, error: "Utilisateur introuvable." };
  }
  const { data, error } = await supabase.rpc("admin_delete_artist", { p_id: id });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok: boolean; error?: string };
  if (!result.ok) return { ok: false, error: result.error ?? "Suppression impossible." };
  return { ok: true };
}
