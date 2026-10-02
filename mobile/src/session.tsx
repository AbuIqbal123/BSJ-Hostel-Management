import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "bsj.session";

export type HallRole = "resident" | "gate" | "warden" | "provost";

export type HallUser = {
  id: string;
  role: HallRole;
  full_name: string;
  username: string;
  status: "active" | "suspended";
};

type StoredSession = {
  accessToken: string;
  refreshToken: string;
  user: HallUser;
};

type SessionValue = {
  ready: boolean;
  user: HallUser | null;
  signIn: (username: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

function apiBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return process.env.EXPO_OS === "android"
    ? "http://10.0.2.2:8000"
    : "http://127.0.0.1:8000";
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    if (typeof body.error?.message === "string" && body.error.message.length > 0) {
      return body.error.message;
    }
  } catch {
    // The hall answered without a message.
  }
  return "The hall could not be reached.";
}

async function readSession(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.accessToken || !parsed.user?.full_name) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<StoredSession | null>(null);

  useEffect(() => {
    let active = true;
    readSession()
      .then((stored) => {
        if (active) {
          setSession(stored);
        }
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    try {
      const response = await fetch(`${apiBase()}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!response.ok) {
        return await errorMessage(response);
      }
      const body = (await response.json()) as {
        access_token: string;
        refresh_token: string;
        user: HallUser;
      };
      const next: StoredSession = {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        user: body.user,
      };
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
      setSession(next);
      return null;
    } catch {
      return "The hall could not be reached.";
    }
  }, []);

  const signOut = useCallback(async () => {
    const current = session;
    setSession(null);
    await SecureStore.deleteItemAsync(SESSION_KEY);
    if (!current) {
      return;
    }
    try {
      await fetch(`${apiBase()}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${current.accessToken}` },
      });
    } catch {
      // The phone session is already cleared.
    }
  }, [session]);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      user: session?.user ?? null,
      signIn,
      signOut,
    }),
    [ready, session, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("Session is missing.");
  }
  return value;
}

export function roleLabel(role: HallRole): string {
  switch (role) {
    case "resident":
      return "Resident";
    case "gate":
      return "Gate";
    case "warden":
      return "Warden";
    case "provost":
      return "Provost";
  }
}
