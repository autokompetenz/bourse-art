import { lazy, Suspense, ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { MarketProvider } from "@/context/MarketContext";
import { Role } from "@/lib/auth";
import Header from "@/components/Layout/Header";
import Footer from "@/components/Layout/Footer";
import Home from "@/pages/Home";

const Orders = lazy(() => import("@/pages/Orders"));
const Login = lazy(() => import("@/pages/Login"));
const ArtistDashboard = lazy(() => import("@/pages/ArtistDashboard"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function PageLoader() {
  return (
    <main className="py-24 text-center">
      <p className="text-muted text-18">Chargement...</p>
    </main>
  );
}

function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/connexion" replace />;
  if (user.role !== role) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/artiste"} replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <Header />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/commandes" element={<Orders />} />
                <Route path="/connexion" element={<Login />} />
                <Route
              path="/artiste"
              element={
                <RequireRole role="artist">
                  <ArtistDashboard />
                </RequireRole>
              }
            />
            <Route
              path="/admin"
              element={
                <RequireRole role="admin">
                  <AdminDashboard />
                </RequireRole>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Footer />
        <Toaster />
      </AppProviders>
    </BrowserRouter>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      enableSystem={false}
      defaultTheme="light"
      forcedTheme="light"
    >
      <AuthProvider>
        <MarketProvider>{children}</MarketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
