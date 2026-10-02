import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { auth, UNAUTHORIZED_EVENT, type User } from "@/lib/api";

interface AuthState {
  loading: boolean;
  setupRequired: boolean;
  user: User | null;
  setup: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const refresh = useCallback(async () => {
    try {
      const status = await auth.status();
      setSetupRequired(status.setupRequired);
      setUser(status.user);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onUnauthorized = (): void => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [refresh]);

  const value: AuthState = {
    loading,
    setupRequired,
    user,
    setup: async (username, password) => {
      const result = await auth.setup(username, password);
      setSetupRequired(false);
      setUser(result.user);
    },
    login: async (username, password) => {
      const result = await auth.login(username, password);
      setUser(result.user);
    },
    logout: async () => {
      await auth.logout();
      setUser(null);
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
