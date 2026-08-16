import { useEffect, useState, FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { isConfigured, sendActivationLink, setOwnPassword } from "@/lib/auth";
import { activateArtist, confirmActivation } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type Mode = "login" | "inscription";

export default function Login() {
  useDocumentTitle("Connexion | Bourse&Art");
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const activation = searchParams.get("activation") === "1";

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  useEffect(() => {
    if (activation && user) {
      setMode("inscription");
    }
  }, [activation, user]);

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

  const handleSendLink = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await sendActivationLink(email);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setLinkSent(true);
  };

  const handleActivateDemo = async (e: FormEvent) => {
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

  const handleSetPassword = async (e: FormEvent) => {
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
    const result = await setOwnPassword(password);
    if (result.ok) {
      const activated = await confirmActivation();
      if (activated.ok) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("users").update({ password_plain: password }).eq("id", user.id);
        }
        toast.success("Mot de passe défini. Bienvenue !");
        setLoading(false);
        navigate("/artiste");
        return;
      }
      toast.error(activated.error);
      setLoading(false);
      return;
    }
    toast.error(result.error);
    setLoading(false);
  };

  const inputClass =
    "w-full rounded-lg border border-dark_border/40 bg-white px-5 py-3 text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10";

  const tabs: { key: Mode; label: string }[] = [
    { key: "login", label: "Connexion" },
    { key: "inscription", label: "Inscription" },
  ];

  const showActivationForm = activation && user && isConfigured();

  return (
    <main className="relative py-16 lg:py-24 overflow-hidden">
      <div className="absolute inset-0 bg-grid" />
      <div className="orb w-[380px] h-[380px] bg-secondary/15 top-[-100px] right-[-100px] animate-float" />
      <div className="container mx-auto max-w-md px-4 relative">
        <div className="border border-dark_border border-opacity-30 rounded-2xl p-6 sm:p-8 bg-dark_grey/50 backdrop-blur">
          <div className="text-center mb-8">
            <h1 className="text-ink text-30 font-medium mb-2">
              {showActivationForm ? "Activez votre compte" : mode === "login" ? "Connexion" : "Inscription"}
            </h1>
            <p className="text-muted text-17">
              {showActivationForm
                ? "Choisissez votre mot de passe pour activer votre compte."
                : mode === "login"
                  ? "Accédez à votre espace artiste ou administrateur."
                  : "Votre compte a été créé par Bourse&Art. Recevez un lien par email pour définir votre mot de passe."}
            </p>
          </div>

          {!showActivationForm && (
            <div className="flex rounded-lg border border-dark_border border-opacity-30 p-1 mb-6">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setMode(t.key);
                    setLinkSent(false);
                  }}
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
          )}

          {showActivationForm ? (
            <form onSubmit={handleSetPassword}>
              <div className="mb-6">
                <label htmlFor="set-password" className="block text-muted text-17 mb-2">Mot de passe</label>
                <input
                  id="set-password"
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
                <label htmlFor="set-confirm" className="block text-muted text-17 mb-2">Confirmer le mot de passe</label>
                <input
                  id="set-confirm"
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
                {loading ? "Activation..." : "Activer mon compte"}
              </button>
            </form>
          ) : mode === "login" ? (
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
          ) : linkSent ? (
            <div className="text-center py-4">
              <p className="text-ink text-18 font-medium mb-2">Lien envoyé !</p>
              <p className="text-muted text-17">
                Vérifiez la boîte mail de <strong>{email}</strong>. Cliquez sur le lien reçu
                pour définir votre mot de passe. Vous pouvez demander un nouveau lien si
                nécessaire.
              </p>
            </div>
          ) : isConfigured() ? (
            <form onSubmit={handleSendLink}>
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
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-grad disabled:opacity-60"
              >
                {loading ? "Envoi..." : "Recevoir le lien par email"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleActivateDemo}>
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

          {!showActivationForm && (
            <p className="text-muted text-16 text-center mt-6">
              Votre compte est créé par Bourse&Art.
            </p>
          )}
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
