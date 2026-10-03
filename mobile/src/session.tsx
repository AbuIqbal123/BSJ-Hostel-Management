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

export type OnboardBody = {
  full_name: string;
  enrolment_number: string;
  password: string;
  phone: string;
  block_id: string;
  room_id: string;
  guardian_name: string;
  guardian_phone: string;
  course?: string;
};

type SessionValue = {
  ready: boolean;
  user: HallUser | null;
  signIn: (username: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  onboard: (body: OnboardBody) => Promise<string | null>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
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
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const onboard = useCallback(async (body: OnboardBody) => {
    const payload: Record<string, string> = {
      full_name: body.full_name.trim(),
      enrolment_number: body.enrolment_number.trim(),
      password: body.password,
      phone: body.phone.trim(),
      block_id: body.block_id,
      room_id: body.room_id,
      guardian_name: body.guardian_name.trim(),
      guardian_phone: body.guardian_phone.trim(),
    };
    const course = body.course?.trim();
    if (course) {
      payload.course = course;
    }
    try {
      const response = await hallFetch("/api/v1/auth/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // Ready copy only after a real 201. This call returns no tokens.
      if (response.status === 201) {
        return null;
      }
      const message = await errorMessage(response);
      const lowered = message.toLowerCase();
      if (lowered.includes("already in use") || lowered.includes("enrolment already")) {
        return "Username or password is wrong.";
      }
      if (response.status === 401 && message === "The hall could not be reached.") {
        return "Username or password is wrong.";
      }
      return message;
    } catch {
      return "The hall could not be reached.";
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const current = sessionRef.current;
    if (!current) {
      return "Sign in again.";
    }
    try {
      const response = await hallFetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${current.accessToken}`,
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (response.status === 204) {
        setSession(null);
        await SecureStore.deleteItemAsync(SESSION_KEY);
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached.";
    }
  }, []);

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
      onboard,
      changePassword,
    }),
    [ready, session, signIn, signOut, onboard, changePassword],
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
