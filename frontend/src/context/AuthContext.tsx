import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from "react";
import {
  registerForcedLogoutHandler,
  setAccessToken,
} from "../services/apiClient";
import { authService } from "../services/authService";
import { userService } from "../services/userService";
import { User } from "../types";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isBooting: boolean; // initial silent-refresh in progress
  /** Called by the final face-verify step with the freshly minted access token. */
  finalizeLogin: (accessToken: string) => Promise<User>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const bootstrapped = useRef(false);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await userService.me();
    setUser(me);
  }, []);

  const finalizeLogin = useCallback(async (accessToken: string) => {
    setAccessToken(accessToken);
    const me = await userService.me();
    setUser(me);
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Even if the network call fails, drop the local session.
    }
    clearSession();
  }, [clearSession]);

  // Silent bootstrap: try to re-mint an access token from the HttpOnly refresh
  // cookie, then load the current user. Runs once on mount.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    // If the session can't be refreshed later (e.g. refresh token revoked),
    // the API layer calls this to drop us back to a logged-out state.
    registerForcedLogoutHandler(() => clearSession());

    (async () => {
      try {
        const res = await authService.refresh();
        setAccessToken(res.access_token);
        await refreshUser();
      } catch {
        clearSession();
      } finally {
        setIsBooting(false);
      }
    })();

    return () => registerForcedLogoutHandler(null);
  }, [clearSession, refreshUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isBooting,
      finalizeLogin,
      refreshUser,
      logout,
    }),
    [user, isBooting, finalizeLogin, refreshUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
