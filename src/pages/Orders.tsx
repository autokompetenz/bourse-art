import { useState, FormEvent, ChangeEvent, useRef } from "react";
import toast from "react-hot-toast";
import { createOrder } from "@/lib/db";
import { compressImage } from "@/utils/image";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function Orders() {
  useDocumentTitle("Commander un tableau | Bourse&Art");

  const [form, setForm] = useState({
    client_name: "",
    client_email: "",
    description: "",
    budget: "",
  });
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState("");
  const [processingImage, setProcessingImage] = useState(false);
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await createOrder({
        clientName: form.client_name,
        clientEmail: form.client_email,
        description: form.description,
        budget: form.budget,
        imageUrl: imageDataUrl,
      });
      if (!result.ok) throw new Error(result.error);
      toast.success("Commande envoyée ! Un artiste vous contactera bientôt.");
      setForm({ client_name: "", client_email: "", description: "", budget: "" });
      setImageDataUrl(null);
      setImageName("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Une erreur est survenue.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-dark_border/40 bg-white px-5 py-3 text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10";

  return (
    <main className="relative py-16 lg:py-24 overflow-hidden">
      <div className="absolute inset-0 bg-grid" />
      <div className="orb w-[400px] h-[400px] bg-primary/15 top-[-120px] left-[-120px] animate-float" />
      <div className="container mx-auto lg:max-w-screen-xl px-4 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <span className="chip !text-primary !border-primary/40 mb-4">Commandes d'art</span>
            <h1 className="text-ink lg:text-44 text-30 font-medium mb-6">
              Commandez votre tableau personnalisé
            </h1>
            <p className="text-muted text-18">
              Décrivez le type de tableau que vous souhaitez : le style, les
              couleurs, le format. Votre demande sera transmise aux artistes qui
              étudieront votre commande.
            </p>
            <ul className="mt-8 space-y-5">
              {[
                {
                  n: "1",
                  t: "Décrivez votre projet de tableau (style, thème, couleurs, format).",
                },
                {
                  n: "2",
                  t: "Indiquez votre budget indicatif et vos coordonnées.",
                },
                {
                  n: "3",
                  t: "Un artiste vous contacte pour finaliser la commande.",
                },
              ].map((s) => (
                <li key={s.n} className="flex gap-4 items-start">
                  <span className="shrink-0 grid place-items-center w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary text-darkmode font-bold text-17">
                    {s.n}
                  </span>
                  <p className="text-muted text-17 pt-1.5">{s.t}</p>
                </li>
              ))}
            </ul>
          </div>

          <form
            onSubmit={handleSubmit}
            className="border border-dark_border border-opacity-30 rounded-2xl p-5 sm:p-8 bg-dark_grey/50 backdrop-blur"
          >
            <div className="mb-6">
              <label className="block text-muted text-17 mb-2">Votre nom</label>
              <input
                type="text"
                required
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                className={inputClass}
                placeholder="Jean Dupont"
              />
            </div>
            <div className="mb-6">
              <label className="block text-muted text-17 mb-2">Votre email</label>
              <input
                type="email"
                required
                value={form.client_email}
                onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                className={inputClass}
                placeholder="jean@example.com"
              />
            </div>
            <div className="mb-6">
              <label className="block text-muted text-17 mb-2">
                Description du tableau souhaité
              </label>
              <textarea
                required
                rows={5}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={inputClass}
                placeholder="Par exemple : un portrait abstrait aux tons bleus et or, format 60x80 cm..."
              />
            </div>
            <div className="mb-6">
              <label className="block text-muted text-17 mb-2">
                Image de référence (optionnel)
              </label>
              <div className="border border-dashed border-dark_border/50 rounded-lg p-4 text-center">
                {processingImage ? (
                  <p className="text-muted text-16 py-3">Traitement de l'image...</p>
                ) : imageDataUrl ? (
                  <div>
                    <img
                      src={imageDataUrl}
                      alt="Aperçu de l'image"
                      className="max-h-52 mx-auto rounded-lg border border-dark_border/30"
                    />
                    <p className="text-muted text-15 mt-3 truncate">{imageName}</p>
                    <div className="flex justify-center gap-4 mt-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-primary text-16 hover:underline"
                      >
                        Choisir une autre image
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImageDataUrl(null);
                          setImageName("");
                        }}
                        className="text-error text-16 hover:underline"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 text-muted text-16 hover:text-primary transition"
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mx-auto mb-2"
                      aria-hidden="true"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    Touchez pour prendre une photo ou choisir une image
                    <span className="block text-14">
                      depuis votre téléphone ou votre ordinateur
                    </span>
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
            </div>
            <div className="mb-8">
              <label className="block text-muted text-17 mb-2">
                Budget indicatif (optionnel)
              </label>
              <input
                type="text"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                className={inputClass}
                placeholder="500 CHF"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-grad disabled:opacity-60"
            >
              {loading ? "Envoi en cours..." : "Envoyer ma commande"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
