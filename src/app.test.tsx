import { beforeEach, describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { AppProviders } from "./App";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Orders from "./pages/Orders";

beforeEach(() => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  return () => error.mockRestore();
});

function renderWithProviders(node: React.ReactNode) {
  return renderToString(
    <MemoryRouter initialEntries={["/"]}>
      <AppProviders>{node}</AppProviders>
    </MemoryRouter>
  );
}

describe("rendu SSR", () => {
  it("affiche la page d'accueil", () => {
    const html = renderWithProviders(<Home />);
    expect(html).toContain("Suivez la bourse");
    expect(html).toContain("Cours des actions");
    expect(html).toContain("Actualités de la bourse");
  });

  it("affiche la page de commande", () => {
    const html = renderWithProviders(<Orders />);
    expect(html).toContain("Commandez votre tableau personnalisé");
  });

  it("affiche la page de connexion", () => {
    const html = renderWithProviders(<Login />);
    expect(html).toContain("Connexion");
  });
});
