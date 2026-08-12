import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-[13px] font-semibold uppercase tracking-[0.14em] transition ${
    isActive ? "text-primary" : "text-muted hover:text-primary"
  }`;

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    setOpen(false);
    logout();
    navigate("/");
  };

  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 w-full glass border-b border-dark_border border-opacity-30">
      <div className="container mx-auto lg:max-w-screen-xl px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center" onClick={close}>
          <span className="text-ink text-24 font-bold leading-none">
            Bourse<span className="text-primary">&</span>Art
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          <NavLink to="/" className={navClass} end>
            Accueil
          </NavLink>
          <NavLink to="/commandes" className={navClass}>
            Commander un tableau
          </NavLink>
          {user ? (
            <>
              <NavLink
                to={user.role === "admin" ? "/admin" : "/artiste"}
                className={navClass}
              >
                {user.role === "admin" ? "Espace Admin" : "Espace Artiste"}
              </NavLink>
              <button
                onClick={handleLogout}
                className="text-[13px] font-semibold uppercase tracking-[0.14em] text-error hover:underline"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <NavLink to="/connexion" className="btn-grad !px-6 !py-2.5">
              Connexion
            </NavLink>
          )}
        </nav>

        <button
          onClick={() => setOpen(!open)}
          aria-label="Menu"
          className="lg:hidden grid place-items-center w-10 h-10 rounded-lg border border-dark_border border-opacity-40 text-ink"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="lg:hidden border-t border-dark_border border-opacity-20 bg-darkmode px-4 py-4 flex flex-col gap-4">
          <NavLink to="/" className={navClass} end onClick={close}>
            Accueil
          </NavLink>
          <NavLink to="/commandes" className={navClass} onClick={close}>
            Commander un tableau
          </NavLink>
          {user ? (
            <>
              <NavLink
                to={user.role === "admin" ? "/admin" : "/artiste"}
                className={navClass}
                onClick={close}
              >
                {user.role === "admin" ? "Espace Admin" : "Espace Artiste"}
              </NavLink>
              <button
                onClick={handleLogout}
                className="text-[13px] font-semibold uppercase tracking-[0.14em] text-left text-error hover:underline"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <NavLink to="/connexion" className="btn-grad w-full !px-5 !py-2.5" onClick={close}>
              Connexion
            </NavLink>
          )}
        </nav>
      )}
    </header>
  );
};

export default Header;
