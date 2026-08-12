import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import {
  AuthResult,
  getSession,
  onAuthStateChange,
  Profile,
  signIn as apiSignIn,
  signOut as apiSignOut,
} from "@/lib/auth";

type AuthContextType = {
  user: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => ({ ok: false, error: "Non initialisé." }),
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void getSession()
      .then((session) => {
        if (active) setUser(session);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const unsubscribe = onAuthStateChange((session) => {
      if (active) setUser(session);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiSignIn(email, password);
    if (result.ok) setUser(result.user);
    return result;
  }, []);

  const logout = useCallback(async () => {
    await apiSignOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
