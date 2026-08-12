import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { isConfigured } from "@/lib/auth";
import { activateArtist } from "@/lib/db";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type Mode = "login" | "inscription";

export default function Login() {
  useDocumentTitle("Connexion | Bourse&Art");
  const { login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error || "Connexion impossible.");
      return;
    }
    toast.success("Connexion réussie.");
    navigate(result.user.role === "admin" ? "/admin" : "/artiste");
  };

  const handleActivate = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (password !== confirm) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const result = await activateArtist(email, password);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Compte activé. Connexion en cours...");
    const loginResult = await login(email, password);
    if (!loginResult.ok) {
      toast.error(loginResult.error || "Connexion impossible.");
      return;
    }
    navigate(loginResult.user.role === "admin" ? "/admin" : "/artiste");
  };

  const inputClass =
    "w-full rounded-lg border border-dark_border/40 bg-white px-5 py-3 text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10";

  const tabs: { key: Mode; label: string }[] = [
    { key: "login", label: "Connexion" },
    { key: "inscription", label: "Inscription" },
  ];

  return (
    <main className="relative py-16 lg:py-24 overflow-hidden">
      <div className="absolute inset-0 bg-grid" />
      <div className="orb w-[380px] h-[380px] bg-secondary/15 top-[-100px] right-[-100px] animate-float" />
      <div className="container mx-auto max-w-md px-4 relative">
        <div className="border border-dark_border border-opacity-30 rounded-2xl p-6 sm:p-8 bg-dark_grey/50 backdrop-blur">
          <div className="text-center mb-8">
            <h1 className="text-ink text-30 font-medium mb-2">
              {mode === "login" ? "Connexion" : "Inscription"}
            </h1>
            <p className="text-muted text-17">
              {mode === "login"
                ? "Accédez à votre espace artiste ou administrateur."
                : "Votre compte a été créé par l'administrateur. Choisissez votre mot de passe."}
            </p>
          </div>

          <div className="flex rounded-lg border border-dark_border border-opacity-30 p-1 mb-6">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setMode(t.key)}
                className={`flex-1 py-2 rounded-md text-16 font-medium transition ${
                  mode === t.key
                    ? "bg-primary text-darkmode"
                    : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {mode === "login" ? (
            <form onSubmit={handleLogin}>
              <div className="mb-6">
                <label htmlFor="login-email" className="block text-muted text-17 mb-2">Email</label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="vous@exemple.com"
                />
              </div>
              <div className="mb-8">
                <label htmlFor="login-password" className="block text-muted text-17 mb-2">Mot de passe</label>
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-grad disabled:opacity-60"
              >
                {loading ? "Connexion..." : "Se connecter"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleActivate}>
              <div className="mb-6">
                <label htmlFor="signup-email" className="block text-muted text-17 mb-2">Email</label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="vous@exemple.com"
                />
              </div>
              <div className="mb-6">
                <label htmlFor="signup-password" className="block text-muted text-17 mb-2">Mot de passe</label>
                <input
                  id="signup-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="6 caractères minimum"
                />
              </div>
              <div className="mb-8">
                <label htmlFor="signup-confirm" className="block text-muted text-17 mb-2">Confirmer le mot de passe</label>
                <input
                  id="signup-confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-grad disabled:opacity-60"
              >
                {loading ? "Création..." : "Créer mon compte"}
              </button>
            </form>
          )}

          <p className="text-muted text-16 text-center mt-6">
            Votre compte est créé par l'administrateur du site.
          </p>
          {!isConfigured() && (
            <div className="mt-6 border border-warning border-opacity-40 bg-warning bg-opacity-10 rounded-lg p-4 text-15">
              <p className="text-ink font-medium mb-1">Mode démo (sans Supabase)</p>
              <p className="text-muted">
                Admin : admin@bourse.com / admin123 · Artiste : artiste@demo.com / artist123
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
