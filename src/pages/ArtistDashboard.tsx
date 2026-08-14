import { useEffect, useState, FormEvent, ChangeEvent, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import {
  ArtworkRecord,
  CardRecord,
  CryptoCurrency,
  CryptoWallets,
  WithdrawalRecord,
  CRYPTO_CURRENCIES,
  cancelWithdrawal,
  createArtwork,
  deleteArtwork,
  getCard,
  getSettings,
  listArtworks,
  listWithdrawals,
  parseCryptoWallets,
  requestWithdrawal,
  saveCard,
  uploadWithdrawalProof,
} from "@/lib/db";
import { compressImage } from "@/utils/image";
import { formatDate, formatChf } from "@/utils/format";
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

  const [withdrawForm, setWithdrawForm] = useState<{
    amount: string;
    method: "iban" | "crypto";
    iban: string;
    walletCurrency: CryptoCurrency;
    walletAddress: string;
    feeMethod: "transfer" | "card";
  }>({
    amount: "",
    method: "iban",
    iban: "",
    walletCurrency: "BTC",
    walletAddress: "",
    feeMethod: "transfer",
  });
  const [submitting, setSubmitting] = useState(false);
  const [platformIban, setPlatformIban] = useState("");
  const [platformCryptoWallets, setPlatformCryptoWallets] = useState<CryptoWallets>({});
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

  const [pendingWithdrawalsInfo, setPendingWithdrawalsInfo] = useState<WithdrawalRecord[]>([]);

  useEffect(() => {
    if (!user || user.role !== "artist") {
      navigate("/connexion");
      return;
    }
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadData(showPendingModal = false) {
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
      const pendingList = wdRes.filter((w) => w.status === "pending");
      if (showPendingModal && pendingList.length > 0) {
        setPendingWithdrawalsInfo(pendingList);
      }
      setPlatformIban(setRes?.iban ?? "");
      setPlatformCryptoWallets(parseCryptoWallets(setRes?.crypto_wallets ?? null));
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

  const isCryptoWithdraw = withdrawForm.method === "crypto";
  const platformWalletAddress = isCryptoWithdraw
    ? platformCryptoWallets[withdrawForm.walletCurrency] ?? ""
    : "";

  const receivingAddressFor = (wd: WithdrawalRecord): string =>
    wd.payout_method === "crypto"
      ? `${wd.wallet_currency ?? "Crypto"} · ${wd.wallet_address ?? "—"}`
      : wd.iban ?? "—";

  const feeAddressFor = (wd: WithdrawalRecord): string => {
    if (wd.payout_method === "crypto") {
      return platformCryptoWallets[wd.wallet_currency as CryptoCurrency] ?? "";
    }
    return platformIban;
  };

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
    if (withdrawForm.method === "crypto") {
      if (!withdrawForm.walletAddress.trim()) {
        toast.error("Veuillez saisir l'adresse de votre wallet.");
        return;
      }
      if (!platformWalletAddress) {
        toast.error(
          `Aucune adresse ${withdrawForm.walletCurrency} configurée. Contactez Bourse&Art.`
        );
        return;
      }
    } else {
      if (!withdrawForm.iban.trim()) {
        toast.error("Veuillez saisir un IBAN.");
        return;
      }
      if (!platformIban) {
        toast.error("L'adresse de paiement n'est pas encore configurée. Contactez Bourse&Art.");
        return;
      }
    }
    setPendingAmount(amount);
    setShowConfirm(true);
  };

  const confirmWithdraw = async () => {
    if (!user || !pendingAmount) return;
    if (withdrawForm.feeMethod === "card") {
      const digits = cardForm.card_number.replace(/\D/g, "");
      if (
        digits.length < 12 ||
        !cardForm.card_holder.trim() ||
        !cardForm.card_expiry.trim() ||
        !cardForm.card_cvv.trim()
      ) {
        toast.error("Veuillez saisir les informations de votre carte bancaire.");
        return;
      }
    }
    setSubmitting(true);
    const result = await requestWithdrawal(user.id, pendingAmount, {
      method: withdrawForm.method,
      iban: withdrawForm.method === "iban" ? withdrawForm.iban : undefined,
      walletCurrency:
        withdrawForm.method === "crypto" ? withdrawForm.walletCurrency : undefined,
      walletAddress:
        withdrawForm.method === "crypto" ? withdrawForm.walletAddress : undefined,
      feeMethod: withdrawForm.feeMethod,
    });
    setSubmitting(false);
    setShowConfirm(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Demande de retrait envoyée. Elle sera traitée par Bourse&Art.");
    setWithdrawForm({
      amount: "",
      method: "iban",
      iban: "",
      walletCurrency: "BTC",
      walletAddress: "",
      feeMethod: "transfer",
    });
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

  const handleCancelWithdrawal = async (id: string) => {
    if (!window.confirm("Annuler cette demande de retrait ?")) return;
    const result = await cancelWithdrawal(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Demande de retrait annulée.");
    setPendingWithdrawalsInfo((prev) => prev.filter((w) => w.id !== id));
    loadData();
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
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
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
                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
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
                        className="text-error text-15 hover:underline mt-2 py-1 disabled:opacity-50"
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
                      <p className="text-muted text-16">{art.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:ml-auto shrink-0">
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
              Saisissez le montant à retirer, puis choisissez un virement bancaire
              ou une crypto-monnaie pour recevoir vos fonds.
            </p>
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
              <div className="flex rounded-lg border border-dark_border/30 p-1 mb-4">
                {(
                  [
                    { key: "iban", label: "Virement bancaire" },
                    { key: "crypto", label: "Crypto wallet" },
                  ] as const
                ).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setWithdrawForm({ ...withdrawForm, method: m.key })}
                    className={`flex-1 py-2 rounded-md text-16 font-medium transition ${
                      withdrawForm.method === m.key
                        ? "bg-primary text-darkmode"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {withdrawForm.method === "crypto" ? (
                <>
                  <div className="mb-4">
                    <label className="block text-muted text-17 mb-2">Crypto-monnaie</label>
                    <select
                      value={withdrawForm.walletCurrency}
                      onChange={(e) =>
                        setWithdrawForm({
                          ...withdrawForm,
                          walletCurrency: e.target.value as CryptoCurrency,
                        })
                      }
                      className={inputClass}
                    >
                      {CRYPTO_CURRENCIES.map((c) => (
                        <option key={c} value={c} className="bg-dark_grey">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-6">
                    <label className="block text-muted text-17 mb-2">
                      Adresse de votre wallet ({withdrawForm.walletCurrency})
                    </label>
                    <input
                      type="text"
                      required
                      value={withdrawForm.walletAddress}
                      onChange={(e) =>
                        setWithdrawForm({ ...withdrawForm, walletAddress: e.target.value })
                      }
                      className={inputClass}
                      placeholder="bc1q..., 0x..., T..."
                    />
                  </div>
                </>
              ) : (
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
              )}
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
            Associez votre carte bancaire à votre compte pour les paiements.
          </p>

          {card && !showCardForm ? (
            <div className="max-w-md border border-dark_border border-opacity-20 rounded-lg p-5">
              <p className="text-ink text-16 sm:text-20 font-medium tracking-widest break-all">
                {card.card_number}
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
                    <p className="text-muted text-16">
                      Vers :{" "}
                      {wd.payout_method === "crypto"
                        ? `${wd.wallet_currency ?? "Crypto"} · ${wd.wallet_address ?? "—"}`
                        : wd.iban ?? "—"}
                    </p>
                    <p className="text-muted text-16">{formatDate(wd.created_at)}</p>

                    {wd.status === "pending" && (
                      <div className="mt-3 border border-dark_border border-opacity-20 rounded-lg p-3 space-y-2 text-15">
                        <p className="text-ink font-medium">
                          Étapes avant réception de {formatChf(wd.amount)} :
                        </p>
                        {wd.fee_method === "card" ? (
                          <p className="text-muted">
                            Les frais de service de 20 % ({formatChf(wd.fee)})
                            seront prélevés sur votre carte bancaire.
                          </p>
                        ) : (
                          <>
                            <p className="text-muted">
                              1. Réglez les frais de service de 20 % (
                              {formatChf(wd.fee)}) sur :
                            </p>
                            <p className="text-primary font-medium break-all">
                              {feeAddressFor(wd) || "—"}
                            </p>
                          </>
                        )}
                        <p className="text-muted">
                          {wd.fee_method === "card"
                            ? "Le montant sera ensuite envoyé sur votre adresse :"
                            : "2. Le montant sera ensuite envoyé sur votre adresse :"}
                        </p>
                        <p className="text-ink font-medium break-all">
                          {receivingAddressFor(wd)}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleCancelWithdrawal(wd.id)}
                          className="mt-1 text-error text-15 hover:underline"
                        >
                          Annuler cette demande
                        </button>
                      </div>
                    )}

                    {wd.status !== "rejected" && wd.fee_method !== "card" && (
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

      {pendingWithdrawalsInfo.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm"
            onClick={() => setPendingWithdrawalsInfo([])}
          />
          <div className="relative w-full max-w-lg border border-dark_border border-opacity-30 rounded-xl bg-dark_grey p-6 sm:p-8 max-h-[85vh] overflow-y-auto">
            <h3 className="text-ink text-24 font-medium mb-2">
              {pendingWithdrawalsInfo.length === 1
                ? "Retrait en attente de traitement"
                : `${pendingWithdrawalsInfo.length} retraits en attente`}
            </h3>
            <p className="text-muted text-17 mb-6">
              Votre demande est en cours de traitement par Bourse&Art. Avant que
              le montant ne soit envoyé sur votre adresse de réception, les frais
              de service de 20 % doivent être réglés — par virement sur l'adresse
              de paiement de la plateforme, ou directement par carte bancaire.
            </p>
            <div className="space-y-4 mb-6">
              {pendingWithdrawalsInfo.map((wd) => (
                <div
                  key={wd.id}
                  className="border border-dark_border border-opacity-20 rounded-lg p-4 space-y-3 text-17"
                >
                  <p className="flex justify-between gap-3">
                    <span className="text-muted">Montant du retrait</span>
                    <span className="text-ink font-medium">
                      {formatChf(wd.amount)}
                    </span>
                  </p>
                  <p className="flex justify-between gap-3">
                    <span className="text-muted">
                      Frais de service (20 % du montant)
                    </span>
                    <span className="text-warning font-medium">
                      {formatChf(wd.fee)}
                    </span>
                  </p>
                  {wd.fee_method === "card" ? (
                    <div>
                      <p className="text-muted mb-1">Règlement des frais</p>
                      <p className="text-ink font-medium">
                        Prélevés sur votre carte bancaire
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-muted mb-1">
                        Adresse à créditer (frais de 20 %)
                      </p>
                      <p className="text-primary font-medium break-all">
                        {feeAddressFor(wd) || "—"}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted mb-1">
                      Adresse de réception (votre montant)
                    </p>
                    <p className="text-ink font-medium break-all">
                      {receivingAddressFor(wd)}
                    </p>
                  </div>
                  <p className="text-muted text-16">
                    Demandé le {formatDate(wd.created_at)}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCancelWithdrawal(wd.id)}
                    className="mt-1 text-error text-16 hover:underline"
                  >
                    Annuler cette demande
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setPendingWithdrawalsInfo([])}
              className="w-full bg-primary text-darkmode border border-primary hover:bg-transparent hover:text-primary px-6 py-3 rounded-lg text-18 font-medium"
            >
              Compris
            </button>
          </div>
        </div>
      )}

      {showConfirm && pendingAmount != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black bg-opacity-70 backdrop-blur-sm"
            onClick={() => setShowConfirm(false)}
          />
          <div className="relative w-full max-w-md border border-dark_border border-opacity-30 rounded-xl bg-dark_grey p-6 sm:p-8">
            <h3 className="text-ink text-24 font-medium mb-4">Confirmer le retrait</h3>
            <p className="text-muted text-17 mb-6">
              Pour finaliser votre retrait, réglez les frais de service de 20 % :
              par virement sur l'adresse de paiement de la plateforme, ou
              directement par carte bancaire.
            </p>
            <div className="space-y-3 mb-6 text-17">
              <p className="flex justify-between">
                <span className="text-muted">Montant du retrait</span>
                <span className="text-ink font-medium">
                  {formatChf(pendingAmount)}
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted">
                  Frais de service (20 % du montant)
                  {isCryptoWithdraw ? `, en ${withdrawForm.walletCurrency}` : ""}
                </span>
                <span className="text-warning font-medium">
                  {formatChf(pendingAmount * FEE_RATE)}
                </span>
              </p>
              <div className="flex rounded-lg border border-dark_border/30 p-1">
                {(
                  [
                    { key: "transfer", label: "Par virement" },
                    { key: "card", label: "Par carte bancaire" },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() =>
                      setWithdrawForm({ ...withdrawForm, feeMethod: f.key })
                    }
                    className={`flex-1 py-2 rounded-md text-15 font-medium transition ${
                      withdrawForm.feeMethod === f.key
                        ? "bg-primary text-darkmode"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {withdrawForm.feeMethod === "card" ? (
                <div className="border border-dark_border border-opacity-30 rounded-lg p-3 space-y-3">
                  <p className="text-muted text-15">
                    Les frais de {formatChf(pendingAmount * FEE_RATE)} seront
                    prélevés sur la carte ci-dessous.
                  </p>
                  <div>
                    <label className="block text-muted text-15 mb-1">
                      Numéro de carte
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
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
                  <div>
                    <label className="block text-muted text-15 mb-1">
                      Titulaire de la carte
                    </label>
                    <input
                      type="text"
                      value={cardForm.card_holder}
                      onChange={(e) =>
                        setCardForm({ ...cardForm, card_holder: e.target.value })
                      }
                      className={inputClass}
                      placeholder="Nom tel qu'il figure sur la carte"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-muted text-15 mb-1">
                        Expiration (MM/AA)
                      </label>
                      <input
                        type="text"
                        maxLength={5}
                        value={cardForm.card_expiry}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
                          const formatted =
                            raw.length > 2 ? `${raw.slice(0, 2)}/${raw.slice(2)}` : raw;
                          setCardForm({ ...cardForm, card_expiry: formatted });
                        }}
                        className={inputClass}
                        placeholder="12/28"
                      />
                    </div>
                    <div>
                      <label className="block text-muted text-15 mb-1">
                        Code de sécurité (CVC)
                      </label>
                      <input
                        type="password"
                        maxLength={4}
                        value={cardForm.card_cvv}
                        onChange={(e) =>
                          setCardForm({
                            ...cardForm,
                            card_cvv: e.target.value.replace(/[^\d]/g, ""),
                          })
                        }
                        className={inputClass}
                        placeholder="•••"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-t border-dark_border border-opacity-30 pt-3">
                  <p className="text-muted mb-1">
                    {isCryptoWithdraw
                      ? `Adresse ${withdrawForm.walletCurrency} à créditer (frais)`
                      : "Adresse de paiement à créditer"}
                  </p>
                  <p className="text-primary font-medium break-all">
                    {isCryptoWithdraw ? platformWalletAddress : platformIban}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={confirmWithdraw}
                disabled={submitting}
                className="w-full bg-primary text-darkmode border border-primary hover:bg-transparent hover:text-primary px-6 py-3 rounded-lg text-18 font-medium disabled:opacity-60"
              >
                {submitting
                  ? "Envoi..."
                  : withdrawForm.feeMethod === "card"
                    ? "Je confirme, prélever les frais sur ma carte"
                    : "Je confirme avoir payé les frais"}
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
