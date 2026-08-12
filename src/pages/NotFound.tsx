import { Link } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function NotFoundPage() {
  useDocumentTitle("404 | Bourse&Art");

  return (
    <main className="relative py-20 lg:py-32 text-center overflow-hidden">
      <div className="absolute inset-0 bg-grid" />
      <div className="orb w-[320px] h-[320px] bg-primary/15 top-[-80px] left-1/2 -translate-x-1/2 animate-pulse-glow" />
      <div className="relative container mx-auto px-4">
        <p className="text-gradient text-[72px] sm:text-[120px] font-bold leading-none">404</p>
        <p className="text-ink text-30 font-medium mt-4 mb-3">
          Oups ! Page introuvable
        </p>
        <p className="text-muted text-18 mb-10">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <Link to="/" className="btn-grad">
          Retour à l'accueil
        </Link>
      </div>
    </main>
  );
}
