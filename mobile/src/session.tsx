import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

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

const LOCAL_HALL = "http://127.0.0.1:8000";

function explicitHall(): string | null {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (!configured) {
    return null;
  }
  return configured.replace(/\/$/, "");
}

// Localhost is the phone itself, or the Android emulator. Only then use the
// computer Expo Go already reached, or the emulator's host alias.
function devMachineHall(): string | null {
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:8000`;
  }
  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000";
  }
  return null;
}

let resolvedHall: string | null = null;

async function hallFetch(path: string, init: RequestInit): Promise<Response> {
  const explicit = explicitHall();
  if (explicit) {
    return fetch(`${explicit}${path}`, init);
  }
  if (resolvedHall) {
    return fetch(`${resolvedHall}${path}`, init);
  }
  try {
    const response = await fetch(`${LOCAL_HALL}${path}`, init);
    resolvedHall = LOCAL_HALL;
    return response;
  } catch {
    const fallback = devMachineHall();
    if (!fallback) {
      throw new Error("The hall could not be reached.");
    }
    const response = await fetch(`${fallback}${path}`, init);
    resolvedHall = fallback;
    return response;
  }
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
      const response = await hallFetch("/api/v1/auth/login", {
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

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const signOut = useCallback(async () => {
    const current = sessionRef.current;
    setSession(null);
    await SecureStore.deleteItemAsync(SESSION_KEY);
    if (!current) {
      return;
    }
    try {
      await hallFetch("/api/v1/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${current.accessToken}` },
      });
    } catch {
      // The phone session is already cleared.
    }
  }, []);

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
