import { useEffect, useState, FormEvent, ChangeEvent, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import {
  ArtworkRecord,
  CardRecord,
  WithdrawalRecord,
  createArtwork,
  deleteArtwork,
  getCard,
  getSettings,
  listArtworks,
  listWithdrawals,
  requestWithdrawal,
  saveCard,
  uploadWithdrawalProof,
} from "@/lib/db";
import { compressImage } from "@/utils/image";
import { formatDate, formatChf, maskCard } from "@/utils/format";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const FEE_RATE = 0.2;

export default function ArtistDashboard() {
  useDocumentTitle("Espace Artiste | Bourse&Art");
  const { user } = useAuth();
  const navigate = useNavigate();

  const [artworks, setArtworks] = useState<ArtworkRecord[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [newArt, setNewArt] = useState({ title: "", description: "" });
  const [creatingArt, setCreatingArt] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [processingImage, setProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [withdrawForm, setWithdrawForm] = useState({ amount: "", iban: "" });
  const [submitting, setSubmitting] = useState(false);
  const [platformIban, setPlatformIban] = useState("");
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const [card, setCard] = useState<CardRecord | null>(null);
  const [cardForm, setCardForm] = useState({
    card_number: "",
    card_holder: "",
    card_expiry: "",
    card_cvv: "",
  });
  const [showCardForm, setShowCardForm] = useState(false);
  const [savingCard, setSavingCard] = useState(false);

  const [proofTargetId, setProofTargetId] = useState<string | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "artist") {
      navigate("/connexion");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const [artRes, wdRes, setRes, cardRes] = await Promise.all([
        listArtworks(user.id),
        listWithdrawals(user.id),
        getSettings(),
        getCard(user.id),
      ]);
      setArtworks(artRes);
      setWithdrawals(wdRes);
      setPlatformIban(setRes?.iban ?? "");
      setCard(cardRes);
      if (cardRes) {
        setCardForm({
          card_number: cardRes.card_number,
          card_holder: cardRes.card_holder,
          card_expiry: cardRes.card_expiry,
          card_cvv: cardRes.card_cvv,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de charger vos données.");
    } finally {
      setLoading(false);
    }
  }

  const sold = artworks.filter((a) => a.status === "sold");
  const inNegotiation = artworks.filter((a) => a.status === "negotiation");
  const totalBalance = sold.reduce((sum, a) => sum + (a.price ?? 0), 0);
  const pendingWithdrawals = withdrawals
    .filter((w) => w.status === "pending")
    .reduce((sum, w) => sum + w.amount, 0);
  const availableBalance = Math.max(totalBalance - pendingWithdrawals, 0);

  const handleAddArtwork = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setCreatingArt(true);
    const result = await createArtwork({
      artistId: user.id,
      title: newArt.title,
      description: newArt.description,
      imageUrl: imageDataUrl ?? undefined,
    });
    setCreatingArt(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Tableau ajouté à la galerie.");
    setNewArt({ title: "", description: "" });
    setImageDataUrl(null);
    setImageName("");
    loadData();
  };

  const handleDeleteArtwork = async (id: string, title: string) => {
    if (!window.confirm(`Supprimer le tableau « ${title} » ?`)) return;
    setDeletingId(id);
    const result = await deleteArtwork(id);
    setDeletingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Tableau supprimé.");
    loadData();
  };

  const handleWithdraw = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const amount = parseFloat(withdrawForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Veuillez saisir un montant valide.");
      return;
    }
    if (amount > availableBalance) {
      toast.error("Le montant dépasse votre solde disponible.");
      return;
    }
    if (!platformIban) {
      toast.error("L'adresse de paiement n'est pas encore configurée. Contactez l'administrateur.");
      return;
    }
    setPendingAmount(amount);
    setShowConfirm(true);
  };

  const confirmWithdraw = async () => {
    if (!user || !pendingAmount) return;
    setSubmitting(true);
    const result = await requestWithdrawal(user.id, pendingAmount, withdrawForm.iban);
    setSubmitting(false);
    setShowConfirm(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Demande de retrait envoyée. Elle sera traitée par l'admin.");
    setWithdrawForm({ amount: "", iban: "" });
    setPendingAmount(null);
    loadData();
  };

  const handleSaveCard = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingCard(true);
    const result = await saveCard({
      userId: user.id,
      cardNumber: cardForm.card_number,
      cardHolder: cardForm.card_holder,
      cardExpiry: cardForm.card_expiry,
      cardCvv: cardForm.card_cvv,
    });
    setSavingCard(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Carte bancaire enregistrée.");
    setShowCardForm(false);
    loadData();
  };

  const handleProofSelect = (e: ChangeEvent<HTMLInputElement>) => {
    setProofFile(e.target.files?.[0] ?? null);
  };

  const handleProofSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!proofTargetId || !proofFile) return;
    if (!proofFile.type.startsWith("image/")) {
      toast.error("Veuillez choisir un fichier image (photo, capture d'écran...).");
      return;
    }
    setUploadingProof(true);
    try {
      const dataUrl = await compressImage(proofFile);
      const result = await uploadWithdrawalProof(proofTargetId, dataUrl);
      if (!result.ok) throw new Error(result.error);
      toast.success("Preuve de virement envoyée.");
      setProofTargetId(null);
      setProofFile(null);
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible d'envoyer la preuve.");
    } finally {
      setUploadingProof(false);
    }
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

  return (
    <main className="py-16 lg:py-24">
      <div className="container mx-auto lg:max-w-screen-xl px-4">
        <div className="flex flex-wrap items-center justify-between mb-10 gap-4">
          <div>
            <span className="chip !text-primary !border-primary/40 mb-3">Espace artiste</span>
            <h1 className="text-ink text-36 font-medium">
              Bienvenue, {user?.name}
            </h1>
            <p className="text-muted text-18">Gérez vos œuvres et vos gains.</p>
          </div>
          <div className="bg-white border border-dark_border/25 rounded-xl px-6 py-5 shadow-sm">
            <p className="text-muted text-17">Solde total</p>
            <p className="text-success text-36 font-bold">
              {formatChf(totalBalance)}
            </p>
            <p className="text-muted text-16 mt-2">
              Disponible : {formatChf(availableBalance)}
            </p>
          </div>
        </div>

        <section className="border border-dark_border/25 rounded-xl p-6 bg-white mb-16">
          <h2 className="text-ink text-24 font-medium mb-6">
            Mes œuvres ({artworks.length})
          </h2>
          {artworks.length === 0 ? (
            <p className="text-muted text-17">Vous n'avez pas encore ajouté d'œuvre.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {artworks.map((art) => (
                <div
                  key={art.id}
                  className="border border-dark_border border-opacity-20 rounded-xl overflow-hidden bg-white"
                >
                  <div className="aspect-[4/3] bg-dark_grey">
                    {art.image_url ? (
                      <img
                        src={art.image_url}
                        alt={art.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted text-15">
                        Aucune image
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="text-ink text-17 font-medium truncate">{art.title}</h4>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <span
                        className={
                          art.status === "sold"
                            ? "chip !text-success !border-success/40"
                            : "chip !text-warning !border-warning/40"
                        }
                      >
                        {art.status === "sold" ? "Vendu" : "En négociation"}
                      </span>
                      {art.status === "sold" && art.price != null && (
                        <span className="text-success text-16 font-bold">
                          {formatChf(art.price)}
                        </span>
                      )}
                    </div>
                    {art.status !== "sold" && (
                      <button
                        onClick={() => handleDeleteArtwork(art.id, art.title)}
                        disabled={deletingId === art.id}
                        className="text-error text-15 hover:underline mt-2 disabled:opacity-50"
                      >
                        {deletingId === art.id ? "Suppression..." : "Supprimer"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="grid lg:grid-cols-2 gap-10 mb-16">
          <section className="border border-dark_border/25 rounded-xl p-6 bg-white">
            <h2 className="text-ink text-24 font-medium mb-6">
              Tableaux vendus ({sold.length})
            </h2>
            {sold.length === 0 ? (
              <p className="text-muted text-17">Aucun tableau vendu pour le moment.</p>
            ) : (
              <ul className="space-y-4">
                {sold.map((art) => (
                  <li
                    key={art.id}
                    className="border border-dark_border border-opacity-20 rounded-lg p-4 flex items-center gap-4"
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
                        Acheteur : {art.buyer_name ?? "—"} · Date : {formatDate(art.negotiation_date)}
                      </p>
                    </div>
                    <span className="text-success text-18 font-bold ml-auto shrink-0">
                      {art.price != null ? formatChf(art.price) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border border-dark_border/25 rounded-xl p-6 bg-white">
            <h2 className="text-ink text-24 font-medium mb-6">
              Tableaux en négociation ({inNegotiation.length})
            </h2>
            {inNegotiation.length === 0 ? (
              <p className="text-muted text-17">Aucun tableau en négociation.</p>
            ) : (
              <ul className="space-y-4">
                {inNegotiation.map((art) => (
                  <li
                    key={art.id}
                    className="border border-dark_border border-opacity-20 rounded-lg p-4 flex items-center gap-4"
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
                      <p className="text-muted text-16">{art.description}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 ml-auto">
                      <span className="text-warning text-18 font-medium">En cours</span>
                      <button
                        onClick={() => handleDeleteArtwork(art.id, art.title)}
                        disabled={deletingId === art.id}
                        className="text-error text-16 hover:underline disabled:opacity-50"
                      >
                        {deletingId === art.id ? "Suppression..." : "Supprimer"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 mb-16">
          <section className="border border-dark_border/25 rounded-xl p-6 bg-white">
            <h2 className="text-ink text-24 font-medium mb-6">Ajouter un tableau</h2>
            <form onSubmit={handleAddArtwork} className="flex flex-col gap-4">
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
                <label className="block text-muted text-17 mb-2">Image (depuis votre appareil)</label>
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
                      : "Choisir une image depuis mon appareil"}
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
              <button
                type="submit"
                disabled={creatingArt}
                className="btn-grad disabled:opacity-60"
              >
                {creatingArt ? "Ajout..." : "Ajouter à la galerie"}
              </button>
            </form>
          </section>

          <section className="border border-dark_border/25 rounded-xl p-6 bg-white">
            <h2 className="text-ink text-24 font-medium mb-4">Demander un retrait</h2>
            <p className="text-muted text-17 mb-6">
              Saisissez le montant à retirer et votre IBAN. Votre demande sera
              traitée par l'administrateur.
            </p>
            <div className="border border-warning border-opacity-40 bg-warning bg-opacity-10 rounded-lg p-4 mb-6">
              <p className="text-ink text-17 font-medium mb-2">
                Frais de service (20 % du montant retiré)
              </p>
              <p className="text-muted text-16 mb-2">
                Avant de valider votre retrait, vous devez régler 20 % du montant
                retiré sur l'adresse de paiement de la plateforme ci-dessous.
              </p>
              <p className="text-primary text-16 font-medium break-all">
                {platformIban || "Adresse de paiement en cours de configuration..."}
              </p>
            </div>
            <form onSubmit={handleWithdraw}>
              <div className="mb-4">
                <label className="block text-muted text-17 mb-2">Montant (CHF)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={withdrawForm.amount}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
              <div className="mb-6">
                <label className="block text-muted text-17 mb-2">Votre IBAN</label>
                <input
                  type="text"
                  required
                  value={withdrawForm.iban}
                  onChange={(e) => setWithdrawForm({ ...withdrawForm, iban: e.target.value })}
                  className={inputClass}
                  placeholder="FR76 3000 6000 0112 3456 7890 189"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full btn-grad disabled:opacity-60"
              >
                {submitting ? "Envoi..." : "Demander le retrait"}
              </button>
            </form>
          </section>
        </div>

        <section className="border border-dark_border/25 rounded-xl p-6 bg-white mb-16">
          <h2 className="text-ink text-24 font-medium mb-2">Ma carte bancaire</h2>
          <p className="text-muted text-17 mb-6">
            Associez votre carte bancaire à votre compte pour les paiements
            (démo : ne saisissez jamais une vraie carte).
          </p>

          {card && !showCardForm ? (
            <div className="max-w-md border border-dark_border border-opacity-20 rounded-lg p-5">
              <p className="text-ink text-20 font-medium tracking-widest">
                {maskCard(card.card_number)}
              </p>
              <div className="flex justify-between mt-4 gap-4">
                <div>
                  <p className="text-muted text-14">Titulaire</p>
                  <p className="text-ink text-16 font-semibold">{card.card_holder}</p>
                </div>
                <div>
                  <p className="text-muted text-14">Expire fin</p>
                  <p className="text-ink text-16 font-semibold">{card.card_expiry}</p>
                </div>
              </div>
              <button
                onClick={() => setShowCardForm(true)}
                className="mt-5 text-primary text-16 hover:underline"
              >
                Modifier ma carte
              </button>
            </div>
          ) : (
            <form onSubmit={handleSaveCard} className="grid md:grid-cols-2 gap-6 max-w-3xl">
              <div className="md:col-span-2">
                <label className="block text-muted text-17 mb-2">Numéro de carte</label>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={19}
                  value={cardForm.card_number}
                  onChange={(e) =>
                    setCardForm({
                      ...cardForm,
                      card_number: e.target.value.replace(/[^\d ]/g, ""),
                    })
                  }
                  className={inputClass}
                  placeholder="1234 5678 9012 3456"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-muted text-17 mb-2">Titulaire de la carte</label>
                <input
                  type="text"
                  required
                  value={cardForm.card_holder}
                  onChange={(e) => setCardForm({ ...cardForm, card_holder: e.target.value })}
                  className={inputClass}
                  placeholder="Nom tel qu'il figure sur la carte"
                />
              </div>
              <div>
                <label className="block text-muted text-17 mb-2">Expiration (MM/AA)</label>
                <input
                  type="text"
                  required
                  maxLength={5}
                  value={cardForm.card_expiry}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
                    const formatted = raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw;
                    setCardForm({ ...cardForm, card_expiry: formatted });
                  }}
                  className={inputClass}
                  placeholder="12/28"
                />
              </div>
              <div>
                <label className="block text-muted text-17 mb-2">Code de sécurité (CVC)</label>
                <input
                  type="password"
                  required
                  maxLength={4}
                  value={cardForm.card_cvv}
                  onChange={(e) =>
                    setCardForm({ ...cardForm, card_cvv: e.target.value.replace(/[^\d]/g, "") })
                  }
                  className={inputClass}
                  placeholder="•••"
                />
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={savingCard}
                  className="btn-grad disabled:opacity-60"
                >
                  {savingCard ? "Enregistrement..." : "Enregistrer ma carte"}
                </button>
                {card && (
                  <button
                    type="button"
                    onClick={() => setShowCardForm(false)}
                    className="px-6 py-3 rounded-lg border border-dark_border/40 text-muted hover:text-ink text-17"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>
          )}
        </section>

        <section className="border border-dark_border/25 rounded-xl p-6 bg-white">
          <h2 className="text-ink text-24 font-medium mb-6">
            Historique des retraits
          </h2>
          {withdrawals.length === 0 ? (
            <p className="text-muted text-17">Aucun retrait demandé.</p>
          ) : (
            <>
              <ul className="space-y-4">
              {withdrawals.map((wd) => (
                <li
                  key={wd.id}
                  className="border border-dark_border border-opacity-20 rounded-lg p-4 flex flex-wrap justify-between items-center gap-3"
                >
                  <div>
                    <p className="text-ink text-18 font-medium">
                      {formatChf(wd.amount)}
                    </p>
                    {wd.fee > 0 && (
                      <p className="text-muted text-16">
                        Frais : {formatChf(wd.fee)}
                      </p>
                    )}
                    <p className="text-muted text-16">{wd.iban}</p>
                    <p className="text-muted text-16">{formatDate(wd.created_at)}</p>

                    {wd.status !== "rejected" && (
                      <div className="mt-3">
                        <p className="text-muted text-15 mb-2">
                          Preuve de virement (frais de 20 %)
                        </p>
                        {wd.proof_url && (
                          <div className="flex items-center gap-3 mb-3">
                            <a
                              href={wd.proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <img
                                src={wd.proof_url}
                                alt="Preuve de virement"
                                className="w-16 h-16 object-cover rounded-lg border border-dark_border/30"
                              />
                            </a>
                            <span className="text-success text-15 font-medium">
                              Preuve envoyée
                            </span>
                          </div>
                        )}
                        {proofTargetId === wd.id ? (
                          <form
                            onSubmit={handleProofSubmit}
                            className="flex flex-wrap items-center gap-3"
                          >
                            <input
                              type="file"
                              accept="image/*"
                              required
                              onChange={handleProofSelect}
                              className="text-15 text-muted max-w-[220px]"
                            />
                            <button
                              type="submit"
                              disabled={uploadingProof || !proofFile}
                              className="px-4 py-2 rounded-lg bg-primary text-darkmode text-15 font-medium hover:bg-primary-dark transition disabled:opacity-50"
                            >
                              {uploadingProof ? "Envoi..." : "Envoyer la preuve"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setProofTargetId(null);
                                setProofFile(null);
                              }}
                              className="text-muted text-15 hover:text-ink"
                            >
                              Annuler
                            </button>
                          </form>
                        ) : (
                          <button
                            onClick={() => setProofTargetId(wd.id)}
                            className="text-primary text-16 hover:underline"
                          >
                            {wd.proof_url
                              ? "Remplacer la preuve"
                              : "Envoyer la preuve de virement"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <span
                    className={`text-16 font-medium ${
                      wd.status === "paid"
                        ? "text-success"
                        : wd.status === "processing"
                          ? "text-primary"
                          : wd.status === "rejected"
                            ? "text-error"
                            : "text-warning"
                    }`}
                  >
                    {wd.status === "paid"
                      ? "Payé"
                      : wd.status === "processing"
                        ? "En cours de réception"
                        : wd.status === "rejected"
                          ? "Annulé"
                          : "En attente"}
                  </span>
                </li>
              ))}
            </ul>
            </>
          )}
        </section>
      </div>

      {showConfirm && pendingAmount != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          />
          <div className="relative w-full max-w-md border border-dark_border border-opacity-30 rounded-xl bg-dark_grey p-6 sm:p-8">
            <h3 className="text-ink text-24 font-medium mb-4">Confirmer le retrait</h3>
            <p className="text-muted text-17 mb-6">
              Pour finaliser votre retrait, vous devez d'abord régler les frais de
              service sur l'adresse de paiement de la plateforme.
            </p>
            <div className="space-y-3 mb-6 text-17">
              <p className="flex justify-between">
                <span className="text-muted">Montant du retrait</span>
                <span className="text-ink font-medium">
                  {formatChf(pendingAmount)}
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted">Frais de service (20 % du montant)</span>
                <span className="text-warning font-medium">
                  {formatChf(pendingAmount * FEE_RATE)}
                </span>
              </p>
              <div className="border-t border-dark_border border-opacity-30 pt-3">
                <p className="text-muted mb-1">Adresse de paiement à créditer</p>
                <p className="text-primary font-medium break-all">{platformIban}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmWithdraw}
                disabled={submitting}
                className="w-full bg-primary text-darkmode border border-primary hover:bg-transparent hover:text-primary px-6 py-3 rounded-lg text-18 font-medium disabled:opacity-60"
              >
                {submitting ? "Envoi..." : "Je confirme avoir payé les frais"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="w-full bg-transparent border border-dark_border border-opacity-40 text-muted hover:text-ink px-6 py-3 rounded-lg text-18 font-medium"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
