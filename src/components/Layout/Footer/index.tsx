import { Link } from "react-router-dom";

const Footer: React.FC = () => {
  return (
    <footer className="pt-16 pb-8 bg-darkmode border-t border-dark_border border-opacity-30">
      <div className="container mx-auto lg:max-w-screen-xl px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center">
              <span className="text-ink text-24 font-bold leading-none">
                Bourse<span className="text-primary">&</span>Art
              </span>
            </Link>
            <p className="text-muted text-17 mt-4 max-w-sm">
              Actualités de la bourse, cours des actions et commande de tableaux
              d'art personnalisés auprès d'artistes passionnés.
            </p>
            <div className="flex gap-3 mt-6">
              {[
                { src: "/images/footer/facebook.svg", label: "Facebook" },
                { src: "/images/footer/twitter.svg", label: "Twitter" },
                { src: "/images/footer/linkedin.svg", label: "LinkedIn" },
              ].map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="grid place-items-center w-10 h-10 rounded-lg border border-dark_border border-opacity-40 hover:border-primary hover:-translate-y-0.5 transition"
                >
                  <img src={s.src} alt={s.label} className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-primary mb-4 font-bold text-[12px] uppercase tracking-[0.2em]">Navigation</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/" className="text-muted hover:text-primary text-17">
                  Accueil
                </Link>
              </li>
              <li>
                <Link to="/commandes" className="text-muted hover:text-primary text-17">
                  Commander un tableau
                </Link>
              </li>
              <li>
                <Link to="/connexion" className="text-muted hover:text-primary text-17">
                  Connexion
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-primary mb-4 font-bold text-[12px] uppercase tracking-[0.2em]">Espaces</h4>
            <ul className="space-y-3">
              <li>
                <Link to="/artiste" className="text-muted hover:text-primary text-17">
                  Espace Artiste
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-dark_border border-opacity-20 mt-12 pt-6">
          <p className="text-muted text-opacity-60 text-16">
            © 2026 Bourse&Art. Tous droits réservés.
          </p>
          <p className="text-muted text-opacity-60 text-16">
            Les cours affichés sont fournis à titre informatif.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
