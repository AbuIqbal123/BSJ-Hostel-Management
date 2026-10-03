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

export type UpcomingOuting = {
  id: string;
  place: string;
  startsAt: string | null;
  expectedReturnAt: string;
  canModify: boolean;
};

export type ResidentHome = {
  fullName: string;
  blockName: string | null;
  roomLabel: string | null;
  out: boolean;
  windowOpen: boolean;
  upcoming: UpcomingOuting[];
};

export type ResidentHomeResult =
  | { error: string; home?: undefined }
  | { error: null; home: ResidentHome };

export type DestinationItem = {
  id: string;
  name: string;
};

export type DestinationResult =
  | { error: string; items?: undefined }
  | { error: null; items: DestinationItem[] };

export type PlanOutingBody = {
  destination_id: string;
  starts_at: string;
  expected_return_at: string;
  destination_text?: string;
};

export type UpdateOutingBody = {
  destination_id: string;
  starts_at: string;
  expected_return_at: string;
  destination_text?: string;
};

type SessionValue = {
  ready: boolean;
  user: HallUser | null;
  signIn: (username: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  onboard: (body: OnboardBody) => Promise<string | null>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
  loadResidentHome: () => Promise<ResidentHomeResult>;
  loadDestinations: () => Promise<DestinationResult>;
  planOuting: (body: PlanOutingBody) => Promise<string | null>;
  updateOuting: (outingId: string, body: UpdateOutingBody) => Promise<string | null>;
  cancelOuting: (outingId: string) => Promise<HallFailure | null>;
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

export async function hallFetch(path: string, init: RequestInit): Promise<Response> {
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

type HallFailure = {
  code: string | null;
  message: string;
};

async function errorMessage(response: Response): Promise<string> {
  return (await hallFailure(response)).message;
}

async function hallFailure(response: Response): Promise<HallFailure> {
  try {
    const body = (await response.json()) as { error?: { code?: unknown; message?: unknown } };
    const message =
      typeof body.error?.message === "string" && body.error.message.length > 0
        ? body.error.message
        : "The hall could not be reached.";
    const code = typeof body.error?.code === "string" ? body.error.code : null;
    return { code, message };
  } catch {
    return { code: null, message: "The hall could not be reached." };
  }
}

const lockedOutingIds = new Set<string>();

export function lockOuting(id: string) {
  lockedOutingIds.add(id);
}

export function outingLocked(id: string): boolean {
  return lockedOutingIds.has(id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readUpcoming(value: Record<string, unknown>): UpcomingOuting[] {
  if (!("upcoming_outings" in value) || !Array.isArray(value.upcoming_outings)) {
    return [];
  }
  const items: UpcomingOuting[] = [];
  for (const item of value.upcoming_outings) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      item.id.length === 0 ||
      typeof item.place !== "string" ||
      typeof item.expected_return_at !== "string" ||
      typeof item.can_modify !== "boolean"
    ) {
      continue;
    }
    if (item.starts_at !== null && typeof item.starts_at !== "string") {
      continue;
    }
    items.push({
      id: item.id,
      place: item.place,
      startsAt: item.starts_at,
      expectedReturnAt: item.expected_return_at,
      canModify: item.can_modify,
    });
  }
  return items;
}

function readResidentHome(value: unknown): ResidentHome | null {
  if (
    !isRecord(value) ||
    !isRecord(value.resident) ||
    !("current_outing" in value) ||
    typeof value.ordinary_outing_active !== "boolean"
  ) {
    return null;
  }
  const resident = value.resident;
  if (resident.presence !== "inside" && resident.presence !== "outside") {
    return null;
  }
  if (typeof resident.full_name !== "string" || resident.full_name.length === 0) {
    return null;
  }
  const blockName = typeof resident.block_name === "string" ? resident.block_name : null;
  const roomLabel = typeof resident.room_label === "string" ? resident.room_label : null;
  let outingOutside = false;
  if (value.current_outing !== null) {
    if (!isRecord(value.current_outing) || typeof value.current_outing.status !== "string") {
      return null;
    }
    outingOutside = value.current_outing.status === "outside";
  }
  return {
    fullName: resident.full_name,
    blockName,
    roomLabel,
    out: resident.presence === "outside" || outingOutside,
    windowOpen: value.ordinary_outing_active,
    upcoming: readUpcoming(value),
  };
}

function readDestinations(value: unknown): DestinationItem[] | null {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return null;
  }
  const items: DestinationItem[] = [];
  for (const item of value.items) {
    if (
      !isRecord(item) ||
      typeof item.id !== "string" ||
      item.id.length === 0 ||
      typeof item.name !== "string"
    ) {
      return null;
    }
    items.push({ id: item.id, name: item.name });
  }
  return items;
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

  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

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
      sessionRef.current = next;
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
      setSession(next);
      return null;
    } catch {
      return "The hall could not be reached.";
    }
  }, []);

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
        sessionRef.current = null;
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
    sessionRef.current = null;
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

  const loadResidentHome = useCallback(async (): Promise<ResidentHomeResult> => {
    const current = sessionRef.current;
    if (!current) {
      return { error: "Sign in again." };
    }
    const headers = { Authorization: `Bearer ${current.accessToken}` };
    try {
      const expired = await hallFetch("/api/v1/me/expire-passed", { method: "POST", headers });
      if (!expired.ok) {
        return { error: await errorMessage(expired) };
      }
      const homeResponse = await hallFetch("/api/v1/me/home", { method: "GET", headers });
      if (!homeResponse.ok) {
        return { error: await errorMessage(homeResponse) };
      }
      const home = readResidentHome(await homeResponse.json());
      if (!home) {
        return { error: "The hall could not be reached." };
      }
      return { error: null, home };
    } catch {
      return { error: "The hall could not be reached." };
    }
  }, []);

  const loadDestinations = useCallback(async (): Promise<DestinationResult> => {
    const current = sessionRef.current;
    if (!current) {
      return { error: "Sign in again." };
    }
    try {
      const response = await hallFetch("/api/v1/destinations", {
        method: "GET",
        headers: { Authorization: `Bearer ${current.accessToken}` },
      });
      if (!response.ok) {
        return { error: await errorMessage(response) };
      }
      const items = readDestinations(await response.json());
      if (!items) {
        return { error: "The hall could not be reached." };
      }
      return { error: null, items };
    } catch {
      return { error: "The hall could not be reached." };
    }
  }, []);

  const planOuting = useCallback(async (body: PlanOutingBody) => {
    const current = sessionRef.current;
    if (!current) {
      return "Sign in again.";
    }
    const payload: Record<string, string> = {
      destination_id: body.destination_id,
      starts_at: body.starts_at,
      expected_return_at: body.expected_return_at,
    };
    if (body.destination_text !== undefined) {
      payload.destination_text = body.destination_text;
    }
    try {
      const response = await hallFetch("/api/v1/me/outings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${current.accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (response.status === 201) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached.";
    }
  }, []);

  const updateOuting = useCallback(async (outingId: string, body: UpdateOutingBody) => {
    const current = sessionRef.current;
    if (!current) {
      return "Sign in again.";
    }
    const payload: Record<string, string> = {
      destination_id: body.destination_id,
      starts_at: body.starts_at,
      expected_return_at: body.expected_return_at,
    };
    if (body.destination_text !== undefined) {
      payload.destination_text = body.destination_text;
    }
    try {
      const response = await hallFetch(`/api/v1/me/outings/${outingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${current.accessToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (response.status === 200 || response.status === 201) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached.";
    }
  }, []);

  const cancelOuting = useCallback(async (outingId: string) => {
    const current = sessionRef.current;
    if (!current) {
      return { code: null, message: "Sign in again." };
    }
    try {
      const response = await hallFetch(`/api/v1/me/outings/${outingId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${current.accessToken}` },
      });
      if (response.status === 200 || response.status === 201) {
        return null;
      }
      return await hallFailure(response);
    } catch {
      return { code: null, message: "The hall could not be reached." };
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
      loadResidentHome,
      loadDestinations,
      planOuting,
      updateOuting,
      cancelOuting,
    }),
    [
      ready,
      session,
      signIn,
      signOut,
      onboard,
      changePassword,
      loadResidentHome,
      loadDestinations,
      planOuting,
      updateOuting,
      cancelOuting,
    ],
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
