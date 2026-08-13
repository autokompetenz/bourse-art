import { useEffect, useMemo, useState, FormEvent, ChangeEvent, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import {
  ArtistRecord,
  ArtworkRecord,
  CardWithArtist,
  OrderRecord,
  WithdrawalRecord,
  createArtistAccount,
  createArtwork,
  deleteArtwork,
  deleteArtist,
  getSettings,
  listArtists,
  listArtworks,
  listCards,
  listOrders,
  listWithdrawals,
  markArtworkSold,
  updateWithdrawalStatus,
  revertArtwork,
  saveSettings,
} from "@/lib/db";
import { compressImage } from "@/utils/image";
import { formatDate, formatChf, maskCard } from "@/utils/format";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import type { EmailResult } from "@/lib/email";

const PAGE_SIZE = 8;

function matchAny(text: string, ...terms: (string | null | undefined)[]): boolean {
  const query = text.trim().toLowerCase();
  if (!query) return true;
  return terms.some((t) => (t ?? "").toLowerCase().includes(query));
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center gap-2 mt-6" aria-label="Pagination">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="px-4 py-2 rounded-lg border border-dark_border/30 text-16 text-muted hover:text-ink disabled:opacity-40"
      >
        Précédent
      </button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={`w-10 h-10 rounded-lg text-16 font-medium border ${
            p === page
              ? "bg-primary text-darkmode border-primary"
              : "border-dark_border/30 text-muted hover:text-ink"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="px-4 py-2 rounded-lg border border-dark_border/30 text-16 text-muted hover:text-ink disabled:opacity-40"
      >
        Suivant
      </button>
    </nav>
  );
}

export default function AdminDashboard() {
  useDocumentTitle("Espace Admin | Bourse&Art");
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState<"ventes" | "comptes" | "cartes" | "commandes" | "retraits">("ventes");
  const [artworks, setArtworks] = useState<ArtworkRecord[]>([]);
  const [artists, setArtists] = useState<ArtistRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [cards, setCards] = useState<CardWithArtist[]>([]);
  const [iban, setIban] = useState("");
  const [loading, setLoading] = useState(true);

  const [newUser, setNewUser] = useState({ name: "", email: "" });
  const [creatingUser, setCreatingUser] = useState(false);

  const [saleForm, setSaleForm] = useState<{
    artworkId: string;
    buyer_name: string;
    negotiation_date: string;
    price: string;
  }>({ artworkId: "", buyer_name: "", negotiation_date: "", price: "" });
  const [savingSale, setSavingSale] = useState(false);

  const [newArt, setNewArt] = useState({ artistId: "", title: "", description: "" });
  const [creatingArt, setCreatingArt] = useState(false);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [processingImage, setProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [artSearch, setArtSearch] = useState("");
  const [artPage, setArtPage] = useState(1);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [wdSearch, setWdSearch] = useState("");
  const [wdPage, setWdPage] = useState(1);
  const [wdStatusBusy, setWdStatusBusy] = useState<string | null>(null);
  const [deletingArtworkId, setDeletingArtworkId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const [cardSearch, setCardSearch] = useState("");
  const [cardPage, setCardPage] = useState(1);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/connexion");
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadAll() {
    setLoading(true);
    try {
      const [artRes, ordRes, wdRes, setRes, cardRes, artistRes] = await Promise.all([
        listArtworks(),
        listOrders(),
        listWithdrawals(),
        getSettings(),
        listCards(),
        listArtists(),
      ]);
      setArtworks(artRes);
      setArtists(artistRes);
      setOrders(ordRes);
      setWithdrawals(wdRes);
      setIban(setRes?.iban ?? "");
      setCards(cardRes);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger les données.");
    } finally {
      setLoading(false);
    }
  }

  const filteredArtworks = useMemo(
    () => artworks.filter((a) => matchAny(artSearch, a.title, a.artist_name)),
    [artworks, artSearch]
  );
  const artworkPages = Math.max(1, Math.ceil(filteredArtworks.length / PAGE_SIZE));
  const pageArtworks = filteredArtworks.slice(
    (artPage - 1) * PAGE_SIZE,
    artPage * PAGE_SIZE
  );

  const filteredOrders = useMemo(
    () => orders.filter((o) => matchAny(orderSearch, o.client_name, o.client_email, o.description)),
    [orders, orderSearch]
  );
  const orderPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const pageOrders = filteredOrders.slice(
    (orderPage - 1) * PAGE_SIZE,
    orderPage * PAGE_SIZE
  );

  const filteredWithdrawals = useMemo(
    () => withdrawals.filter((w) => matchAny(wdSearch, w.artist_name, w.iban)),
    [withdrawals, wdSearch]
  );
  const wdPages = Math.max(1, Math.ceil(filteredWithdrawals.length / PAGE_SIZE));
  const pageWithdrawals = filteredWithdrawals.slice(
    (wdPage - 1) * PAGE_SIZE,
    wdPage * PAGE_SIZE
  );

  const filteredCards = useMemo(
    () =>
      cards.filter((c) =>
        matchAny(
          cardSearch,
          c.artist_name,
          c.card_holder,
          c.card_number.slice(-4),
          c.card_expiry
        )
      ),
    [cards, cardSearch]
  );
  const cardPages = Math.max(1, Math.ceil(filteredCards.length / PAGE_SIZE));
  const pageCards = filteredCards.slice((cardPage - 1) * PAGE_SIZE, cardPage * PAGE_SIZE);

  const selectableArtists = artists.filter((a) => !a.pending);

  const handleCreateUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.email.trim()) {
      toast.error("Le nom et l'email sont obligatoires.");
      return;
    }
    setCreatingUser(true);
    const result = await createArtistAccount(newUser.name, newUser.email);
    setCreatingUser(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const emailResult = (result.data as
      | { emailStatus?: "sent" | "error"; emailDetail?: string }
      | undefined);
    if (emailResult?.emailStatus === "error") {
      toast.success("Compte créé, mais le mail d'invitation n'a pas pu être envoyé.");
      toast.error(`Mail non envoyé : ${emailResult.emailDetail ?? "erreur inconnue"}`);
    } else {
      toast.success(
        "Compte créé. L'artiste a reçu un email avec un lien pour définir son mot de passe."
      );
    }
    setNewUser({ name: "", email: "" });
    loadAll();
  };

  const handleSaveSale = async (e: FormEvent) => {
    e.preventDefault();
    if (!saleForm.artworkId) {
      toast.error("Choisissez un tableau.");
      return;
    }
    setSavingSale(true);
    const result = await markArtworkSold({
      id: saleForm.artworkId,
      buyerName: saleForm.buyer_name.trim() || null,
      negotiationDate: saleForm.negotiation_date || null,
      price: saleForm.price ? parseFloat(saleForm.price) : null,
    });
    setSavingSale(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const notification = (result.data as { notification?: EmailResult } | undefined)
      ?.notification;
    if (notification?.status === "sent") {
      toast.success("Vente enregistrée. L'artiste a été notifié par email.");
    } else {
      toast.success("Vente enregistrée. Le solde de l'artiste est mis à jour.");
      if (notification?.status === "error") {
        toast.error(
          `L'email de notification n'a pas pu être envoyé : ${notification.detail ?? "erreur inconnue"}`
        );
      }
    }
    setSaleForm({ artworkId: "", buyer_name: "", negotiation_date: "", price: "" });
    loadAll();
  };

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez choisir un fichier image (JPEG, PNG, WebP...).");
      return;
    }
    setProcessingImage(true);
    try {
      const dataUrl = await compressImage(file);
      setImageDataUrl(dataUrl);
      setImageName(file.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de traiter l'image.");
    } finally {
      setProcessingImage(false);
    }
  };

  const handleAddArtwork = async (e: FormEvent) => {
    e.preventDefault();
    if (!newArt.artistId) {
      toast.error("Choisissez un artiste.");
      return;
    }
    setCreatingArt(true);
    const result = await createArtwork({
      artistId: newArt.artistId,
      title: newArt.title,
      description: newArt.description,
      imageUrl: imageDataUrl ?? undefined,
    });
    setCreatingArt(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Tableau ajouté à la galerie de l'artiste.");
    setNewArt({ artistId: "", title: "", description: "" });
    setImageDataUrl(null);
    setImageName("");
    loadAll();
  };

  const handleRevert = async (artworkId: string) => {
    const result = await revertArtwork(artworkId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Tableau repassé en négociation.");
    loadAll();
  };

  const handleDeleteArtwork = async (id: string, title: string) => {
    if (!window.confirm(`Supprimer le tableau « ${title} » ?`)) return;
    setDeletingArtworkId(id);
    const result = await deleteArtwork(id);
    setDeletingArtworkId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Tableau supprimé.");
    loadAll();
  };

  const handleDeleteArtist = async (a: ArtistRecord) => {
    const label = a.pending
      ? `Supprimer définitivement le compte en attente de « ${a.name} » ?`
      : `Supprimer définitivement l'artiste « ${a.name} » ? Cette action supprime ses œuvres, ses ventes et son compte.`;
    if (!window.confirm(label)) return;
    setDeletingUserId(a.id);
    const result = await deleteArtist(a.id);
    setDeletingUserId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Utilisateur supprimé définitivement.");
    loadAll();
  };

  const handleSaveIban = async () => {
    const result = await saveSettings(iban);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("IBAN mis à jour.");
  };

  const handleChangeWithdrawalStatus = async (id: string, status: string) => {
    const next = status as WithdrawalRecord["status"];
    if (!["pending", "processing", "paid", "rejected"].includes(next)) return;
    if (next === "rejected" && !window.confirm("Annuler cette demande de retrait ?")) return;
    setWdStatusBusy(id);
    const result = await updateWithdrawalStatus(id, next);
    setWdStatusBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Statut du retrait mis à jour.");
    loadAll();
  };

  const inputClass =
    "w-full rounded-lg border border-dark_border/40 bg-white px-5 py-3 text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10";

  if (loading) {
    return (
      <main className="py-16 lg:py-24 text-center">
        <p className="text-muted text-18">Chargement...</p>
      </main>
    );
  }

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "ventes", label: "Ventes" },
    { key: "comptes", label: "Comptes artistes" },
    { key: "cartes", label: "Cartes bancaires" },
    { key: "commandes", label: "Commandes" },
    { key: "retraits", label: "Retraits" },
  ];

  return (
    <main className="py-16 lg:py-24">
      <div className="container mx-auto lg:max-w-screen-xl px-4">
        <span className="chip !text-primary !border-primary/40 mb-3">Administration</span>
        <h1 className="text-ink text-36 font-medium mb-2">Espace Admin</h1>
        <p className="text-muted text-18 mb-8">
          Gérez les ventes, les comptes artistes et les réglages.
        </p>

        <div className="flex flex-wrap gap-3 mb-10">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 rounded-lg text-17 font-medium border ${
                tab === t.key
                  ? "bg-primary text-darkmode border-primary"
                  : "text-muted border-dark_border border-opacity-40 hover:border-primary hover:text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="border border-dark_border/25 rounded-xl p-5 sm:p-8 bg-white shadow-sm mb-10">
          <h2 className="text-ink text-24 font-medium mb-4">IBAN de la plateforme</h2>
          <div className="flex flex-wrap gap-4">
            <input
              type="text"
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              className={`${inputClass} lg:max-w-md`}
              placeholder="FR76 3000 6000 0112 3456 7890 189"
            />
            <button
              onClick={handleSaveIban}
              className="btn-grad !px-6 !py-3 !text-17"
            >
              Enregistrer
            </button>
          </div>
        </div>

        {tab === "ventes" && (
          <section className="border border-dark_border/25 rounded-xl p-6 bg-white">
            <h2 className="text-ink text-24 font-medium mb-6">Enregistrer une vente</h2>
            <form onSubmit={handleSaveSale} className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-muted text-17 mb-2">Tableau</label>
                <select
                  required
                  value={saleForm.artworkId}
                  onChange={(e) => setSaleForm({ ...saleForm, artworkId: e.target.value })}
                  className={inputClass}
                >
                  <option value="" className="bg-dark_grey">
                    Sélectionner un tableau...
                  </option>
                  {artworks.map((art) => (
                    <option key={art.id} value={art.id} className="bg-dark_grey">
                      {art.title} — {art.artist_name ?? "?"} ({art.status})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-muted text-17 mb-2">Nom de l'acheteur</label>
                <input
                  type="text"
                  value={saleForm.buyer_name}
                  onChange={(e) => setSaleForm({ ...saleForm, buyer_name: e.target.value })}
                  className={inputClass}
                  placeholder="Marie Martin"
                />
              </div>
              <div>
                <label className="block text-muted text-17 mb-2">Date de négociation</label>
                <input
                  type="date"
                  value={saleForm.negotiation_date}
                  onChange={(e) => setSaleForm({ ...saleForm, negotiation_date: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-muted text-17 mb-2">Prix (CHF)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={saleForm.price}
                  onChange={(e) => setSaleForm({ ...saleForm, price: e.target.value })}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={savingSale}
                  className="btn-grad disabled:opacity-60"
                >
                  {savingSale ? "Enregistrement..." : "Marquer comme vendu"}
                </button>
              </div>
            </form>

            <div className="mt-10 border-t border-dark_border/20 pt-8">
              <h3 className="text-ink text-22 font-medium mb-2">
                Ajouter un tableau pour un artiste
              </h3>
              <p className="text-muted text-17 mb-6">
                Créez une œuvre directement dans la galerie d'un artiste.
              </p>
              <form onSubmit={handleAddArtwork} className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-muted text-17 mb-2">Artiste</label>
                  <select
                    required
                    value={newArt.artistId}
                    onChange={(e) => setNewArt({ ...newArt, artistId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="" className="bg-dark_grey">
                      Sélectionner un artiste...
                    </option>
                    {selectableArtists.map((a) => (
                      <option key={a.id} value={a.id} className="bg-dark_grey">
                        {a.name} ({a.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-muted text-17 mb-2">Titre</label>
                  <input
                    type="text"
                    required
                    value={newArt.title}
                    onChange={(e) => setNewArt({ ...newArt, title: e.target.value })}
                    className={inputClass}
                    placeholder="Ex : Nuit étoilée"
                  />
                </div>
                <div>
                  <label className="block text-muted text-17 mb-2">
                    Description (technique, format...)
                  </label>
                  <textarea
                    rows={3}
                    value={newArt.description}
                    onChange={(e) => setNewArt({ ...newArt, description: e.target.value })}
                    className={inputClass}
                    placeholder="Ex : Huile sur toile, 60x80cm"
                  />
                </div>
                <div>
                  <label className="block text-muted text-17 mb-2">Image</label>
                  {imageDataUrl ? (
                    <div className="flex items-center gap-4">
                      <img
                        src={imageDataUrl}
                        alt={imageName}
                        className="w-24 h-24 rounded-lg object-cover border border-dark_border/30"
                      />
                      <div className="flex flex-col gap-1">
                        <span className="text-16 text-ink">{imageName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setImageDataUrl(null);
                            setImageName("");
                          }}
                          className="text-error text-16 hover:underline text-left"
                        >
                          Retirer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={processingImage}
                      className="w-full border border-dashed border-dark_border/40 rounded-lg py-8 text-muted text-16 hover:text-primary transition disabled:opacity-50"
                    >
                      {processingImage
                        ? "Traitement de l'image..."
                        : "Choisir une image"}
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={creatingArt}
                    className="btn-grad disabled:opacity-60"
                  >
                    {creatingArt ? "Ajout..." : "Ajouter à la galerie"}
                  </button>
                </div>
              </form>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-10 mb-4">
              <h3 className="text-ink text-22 font-medium">Tableaux ({filteredArtworks.length})</h3>
              <input
                type="search"
                value={artSearch}
                onChange={(e) => {
                  setArtSearch(e.target.value);
                  setArtPage(1);
                }}
                className={`${inputClass} lg:max-w-xs`}
                placeholder="Rechercher un tableau, un artiste..."
              />
            </div>
            {pageArtworks.length === 0 ? (
              <p className="text-muted text-17">Aucun tableau.</p>
            ) : (
              <>
                <ul className="space-y-3">
                  {pageArtworks.map((art) => (
                    <li
                      key={art.id}
                      className="border border-dark_border border-opacity-20 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                    >
                      {art.image_url && (
                        <img
                          src={art.image_url}
                          alt={art.title}
                          className="w-20 h-20 rounded-lg object-cover border border-dark_border/30 shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <h4 className="text-ink text-18 font-medium">{art.title}</h4>
                        <p className="text-muted text-16">
                          Artiste : {art.artist_name ?? "—"} · Statut :{" "}
                          {art.status === "sold" ? "Vendu" : "En négociation"}
                          {art.status === "sold" && art.price != null && (
                            <> · {formatChf(art.price)}</>
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:ml-auto shrink-0">
                        {art.status === "sold" && (
                          <button
                            onClick={() => handleRevert(art.id)}
                            className="text-warning text-17 hover:underline"
                          >
                            Repasser en négociation
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteArtwork(art.id, art.title)}
                          disabled={deletingArtworkId === art.id}
                          className="text-error text-17 hover:underline disabled:opacity-50"
                        >
                          {deletingArtworkId === art.id ? "Suppression..." : "Supprimer"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <Pagination
                  page={artPage}
                  totalPages={artworkPages}
                  onChange={setArtPage}
                />
              </>
            )}
          </section>
        )}

        {tab === "comptes" && (
          <section className="border border-dark_border/25 rounded-xl p-6 bg-white">
            <h2 className="text-ink text-24 font-medium mb-6">Créer un compte artiste</h2>
            <p className="text-muted text-17 mb-6">
              L'artiste choisit lui-même son mot de passe : il reçoit un email avec
              un lien pour l'activer. Le compte reste « en attente d'inscription »
              tant qu'il n'a pas été activé.
            </p>
            <form onSubmit={handleCreateUser} className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-muted text-17 mb-2">Nom</label>
                <input
                  type="text"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className={inputClass}
                  placeholder="Nom de l'artiste"
                />
              </div>
              <div>
                <label className="block text-muted text-17 mb-2">Email</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className={inputClass}
                  placeholder="artiste@exemple.com"
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="btn-grad disabled:opacity-60"
                >
                  {creatingUser ? "Création..." : "Créer le compte"}
                </button>
              </div>
            </form>

            <div className="mt-10">
              <h3 className="text-ink text-22 font-medium mb-4">
                Artistes ({artists.length})
              </h3>
              {artists.length === 0 ? (
                <p className="text-muted text-17">Aucun artiste pour le moment.</p>
              ) : (
                <ul className="space-y-3">
                  {artists.map((a) => (
                    <li
                      key={a.id}
                      className="border border-dark_border border-opacity-20 rounded-lg p-4 flex flex-wrap justify-between items-center gap-3"
                    >
                      <div>
                        <p className="text-ink text-18 font-medium">{a.name}</p>
                        <p className="text-muted text-16">
                          {a.email} · {a.artworks_count} tableau{a.artworks_count > 1 ? "x" : ""}
                          {a.created_at ? ` · inscrit le ${formatDate(a.created_at)}` : ""}
                        </p>
                        {!a.pending && (
                          <p className="text-16 mt-1">
                            <span className="text-muted">Mot de passe : </span>
                            <span className="text-ink font-semibold">
                              {a.password ?? "—"}
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        {a.pending ? (
                          <span className="chip !text-warning !border-warning/40">
                            En attente d'inscription
                          </span>
                        ) : (
                          <span className="chip !text-primary !border-primary/40">Artiste</span>
                        )}
                        <button
                          onClick={() => handleDeleteArtist(a)}
                          disabled={deletingUserId === a.id}
                          className="text-error text-17 hover:underline disabled:opacity-50"
                        >
                          {deletingUserId === a.id ? "Suppression..." : "Supprimer"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {tab === "cartes" && (
          <section className="border border-dark_border/25 rounded-xl p-6 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
              <h2 className="text-ink text-24 font-medium">
                Cartes enregistrées ({filteredCards.length})
              </h2>
              <input
                type="search"
                value={cardSearch}
                onChange={(e) => {
                  setCardSearch(e.target.value);
                  setCardPage(1);
                }}
                className={`${inputClass} lg:max-w-xs`}
                placeholder="Rechercher un artiste..."
              />
            </div>
            <p className="text-muted text-16 mb-6">
              Numéros complets affichés (visibles par l'admin uniquement).
            </p>
            {pageCards.length === 0 ? (
              <p className="text-muted text-17">Aucune carte enregistrée.</p>
            ) : (
              <>
                <ul className="space-y-4">
                  {pageCards.map((c) => (
                    <li
                      key={c.id}
                      className="border border-dark_border border-opacity-20 rounded-lg p-4 flex flex-wrap justify-between items-center gap-3"
                    >
                      <div>
                        <p className="text-ink text-18 font-medium">
                          {c.artist_name ?? "—"} · {c.card_number}
                        </p>
                        <p className="text-muted text-16">
                          {c.card_holder} · Expire fin {c.card_expiry}
                        </p>
                      </div>
                      <span className="text-muted text-16">{formatDate(c.created_at)}</span>
                    </li>
                  ))}
                </ul>
                <Pagination
                  page={cardPage}
                  totalPages={cardPages}
                  onChange={setCardPage}
                />
              </>
            )}
          </section>
        )}

        {tab === "commandes" && (
          <section className="border border-dark_border/25 rounded-xl p-6 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <h2 className="text-ink text-24 font-medium">
                Commandes de tableaux ({filteredOrders.length})
              </h2>
              <input
                type="search"
                value={orderSearch}
                onChange={(e) => {
                  setOrderSearch(e.target.value);
                  setOrderPage(1);
                }}
                className={`${inputClass} lg:max-w-xs`}
                placeholder="Rechercher un client..."
              />
            </div>
            {pageOrders.length === 0 ? (
              <p className="text-muted text-17">Aucune commande.</p>
            ) : (
              <>
                <ul className="space-y-4">
                  {pageOrders.map((order) => (
                    <li
                      key={order.id}
                      className="border border-dark_border border-opacity-20 rounded-lg p-4 flex gap-4"
                    >
                      {order.image_url && (
                        <img
                          src={order.image_url}
                          alt={`Image de la commande de ${order.client_name}`}
                          className="w-20 h-20 object-cover rounded-lg border border-dark_border/20 shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap justify-between items-center gap-2">
                          <h4 className="text-ink text-18 font-medium">{order.client_name}</h4>
                          <span className="text-muted text-16">
                            {formatDate(order.created_at)}
                          </span>
                        </div>
                        <p className="text-muted text-17 mt-2">{order.description}</p>
                        <p className="text-muted text-16 mt-1">
                          {order.client_email}
                          {order.budget && <> · Budget : {order.budget}</>}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <Pagination
                  page={orderPage}
                  totalPages={orderPages}
                  onChange={setOrderPage}
                />
              </>
            )}
          </section>
        )}

        {tab === "retraits" && (
          <section className="border border-dark_border/25 rounded-xl p-6 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
              <h2 className="text-ink text-24 font-medium">
                Demandes de retrait ({filteredWithdrawals.length})
              </h2>
              <input
                type="search"
                value={wdSearch}
                onChange={(e) => {
                  setWdSearch(e.target.value);
                  setWdPage(1);
                }}
                className={`${inputClass} lg:max-w-xs`}
                placeholder="Rechercher un artiste..."
              />
            </div>
            {pageWithdrawals.length === 0 ? (
              <p className="text-muted text-17">Aucune demande de retrait.</p>
            ) : (
              <>
                <ul className="space-y-4">
                  {pageWithdrawals.map((wd) => (
                    <li
                      key={wd.id}
                      className="border border-dark_border border-opacity-20 rounded-lg p-4 flex flex-wrap justify-between items-center gap-3"
                    >
                      <div>
                        <p className="text-ink text-18 font-medium">
                          {wd.artist_name ?? "—"} — {formatChf(wd.amount)}
                        </p>
                        <p className="text-muted text-16">
                          Frais de service (20 %) : {formatChf(wd.fee)}
                        </p>
                        <p className="text-muted text-16">IBAN : {wd.iban}</p>
                        <p className="text-muted text-16">{formatDate(wd.created_at)}</p>
                        {wd.proof_url ? (
                          <div className="flex items-center gap-3 mt-3">
                            <a
                              href={wd.proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <img
                                src={wd.proof_url}
                                alt="Preuve de paiement des frais"
                                className="w-16 h-16 object-cover rounded-lg border border-dark_border/30"
                              />
                            </a>
                            <span className="text-success text-15 font-medium">
                              Preuve de paiement reçue
                            </span>
                          </div>
                        ) : (
                          <p className="text-warning text-15 mt-2">
                            Aucune preuve de paiement
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <select
                          value={wd.status}
                          disabled={wdStatusBusy === wd.id}
                          onChange={(e) => handleChangeWithdrawalStatus(wd.id, e.target.value)}
                          className="rounded-lg border border-dark_border/40 bg-white px-3 py-2 text-16 text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
                          aria-label="Statut du retrait"
                        >
                          <option value="pending" className="bg-dark_grey">
                            En attente
                          </option>
                          <option value="processing" className="bg-dark_grey">
                            En cours de réception
                          </option>
                          <option value="paid" className="bg-dark_grey">
                            Payé
                          </option>
                          <option value="rejected" className="bg-dark_grey">
                            Annulé
                          </option>
                        </select>
                        {wdStatusBusy === wd.id && (
                          <span className="text-muted text-15">Mise à jour...</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <Pagination
                  page={wdPage}
                  totalPages={wdPages}
                  onChange={setWdPage}
                />
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
