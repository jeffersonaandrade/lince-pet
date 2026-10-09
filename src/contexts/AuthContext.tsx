"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { api } from "@/hook/api";
import { logout as authLogout } from "@/services/auth/auth";

interface User {
  id: string;
  email: string;
  userType: string;
  nome: string;
  celular?: string;
  cidade?: string;
  estado?: string;
  createdAt?: string;
  onboardingComplete?: number;
  fotoUrl?: string;
  googleCalendarAuthorized?: boolean;
  subscriptionPlanCode?: string | null;
  monthlyAppointmentsUsed?: number;
  tipoServico?: { slug: string; nome: string; modalidade: string };
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: User) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  

  const login = (userData: User) => {
    setUser(userData);
    setLoading(false);
  };

  const logout = async () => {
    try {
      await authLogout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const checkAuth = useCallback(async () => {
    try {
      // silent: true avoids logging and auto-logout behavior for expected 401s
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await api.get("/auth/me", { silent: true } as any);
      if (response.status === 200 && response.data) {
        if (response.data.user) {
          setUser(response.data.user);
        } else {
          setUser(response.data);
        }
      }
    } catch (error) {
      // Avoid printing full Axios stack in production console during expected 401s
      const status =
        (error as { response?: { status?: number } })?.response?.status ||
        "unknown";
      console.warn(`Auth check failed: ${status}`);
      if (process.env.NODE_ENV === "development") {
        console.debug(error);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    localStorage.removeItem('auth_token');
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, logout, checkAuth, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
