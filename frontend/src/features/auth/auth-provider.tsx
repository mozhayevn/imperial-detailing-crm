"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  loginWithCookie,
  verifyTwoFactorWithCookie,
} from "@/src/features/auth/api";
import { loadAuthSession } from "@/src/features/auth/session";
import type {
  AuthSession,
  LoginRequest,
  LoginResponse,
  VerifyTwoFactorRequest,
} from "@/src/types/auth";

const ACCESS_TOKEN_STORAGE_KEY = "imperial_crm_access_token";

type AuthContextValue = {
  session: AuthSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginRequest) => Promise<LoginResponse>;
  verifyTwoFactor: (payload: VerifyTwoFactorRequest) => Promise<void>;
  logout: () => void;
  refreshSession: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: React.ReactNode;
};

function getStoredAccessToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

function setStoredAccessToken(token: string) {
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

function clearStoredAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();

  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);

    try {
      const token = getStoredAccessToken();
      const nextSession = await loadAuthSession(token);
      setSession(nextSession);
    } catch {
      setSession(null);
      clearStoredAccessToken();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initializeSession() {
      try {
        const token = getStoredAccessToken();
        const nextSession = await loadAuthSession(token);

        if (isMounted) {
          setSession(nextSession);
        }
      } catch {
        clearStoredAccessToken();

        if (isMounted) {
          setSession(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void initializeSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(
    async (payload: LoginRequest): Promise<LoginResponse> => {
      const result = await loginWithCookie(payload);

      if (result.requires_2fa) {
        return result;
      }

      if (!result.access_token) {
        throw new Error("Не удалось получить access token.");
      }

      setIsLoading(true);

      try {
        setStoredAccessToken(result.access_token);

        const nextSession = await loadAuthSession(result.access_token);
        setSession(nextSession);

        router.push("/dashboard");
        router.refresh();

        return result;
      } finally {
        setIsLoading(false);
      }
    },
    [router],
  );

  const verifyTwoFactor = useCallback(
    async (payload: VerifyTwoFactorRequest) => {
      const result = await verifyTwoFactorWithCookie(payload);

      setIsLoading(true);

      try {
        setStoredAccessToken(result.access_token);

        const nextSession = await loadAuthSession(result.access_token);
        setSession(nextSession);

        router.push("/dashboard");
        router.refresh();
      } finally {
        setIsLoading(false);
      }
    },
    [router],
  );

  const logout = useCallback(() => {
    clearStoredAccessToken();
    setSession(null);

    router.push("/login");
    router.refresh();
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session),
      isLoading,
      login,
      verifyTwoFactor,
      logout,
      refreshSession,
    }),
    [session, isLoading, login, verifyTwoFactor, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}