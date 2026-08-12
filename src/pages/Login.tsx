import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { isConfigured } from "@/lib/auth";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function Login() {
  useDocumentTitle("Connexion | Bourse&Art");
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
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

  const inputClass =
    "w-full rounded-lg border border-dark_border/40 bg-white px-5 py-3 text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10";

  return (
    <main className="relative py-16 lg:py-24 overflow-hidden">
      <div className="absolute inset-0 bg-grid" />
      <div className="orb w-[380px] h-[380px] bg-secondary/15 top-[-100px] right-[-100px] animate-float" />
      <div className="container mx-auto max-w-md px-4 relative">
        <div className="border border-dark_border border-opacity-30 rounded-2xl p-6 sm:p-8 bg-dark_grey/50 backdrop-blur">
          <div className="text-center mb-8">
            <h1 className="text-ink text-30 font-medium mb-2">Connexion</h1>
            <p className="text-muted text-17">
              Accédez à votre espace artiste ou administrateur.
            </p>
          </div>
          <form onSubmit={handleSubmit}>
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
