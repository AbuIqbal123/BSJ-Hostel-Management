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
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";

import {
  biometricLabel,
  biometricSignInEnabled,
  biometricSignInReady,
  biometricsAvailable,
  clearBiometricSignIn,
  confirmBiometrics,
  readBiometricCredentials,
  saveBiometricCredentials,
  setBiometricSignInEnabled,
} from "@/biometrics";
import { pageQuery } from "@/list-page";
import { errorMessage, hallFailure, hallFetch, type HallFailure } from "@/hall-http";
import { isRecord } from "@/json";
import { forgetOfficeSettings } from "@/office-settings-cache";
import { phoneDelete, phoneGet, phoneSet } from "@/phone-store";
import { allowReturnReminders, clearNotificationSurface, PUSH_TOKEN_KEY, pushToken } from "@/push";
import {
  guestListQuery,
  outingPayload,
  permissionPayload,
  readDestinations,
  readGuestPage,
  readGuestStay,
  readHallPass,
  readHistory,
  readPermission,
  readPermissionPage,
  readResidentHome,
  readTotal,
  type DestinationResult,
  type GuestListResult,
  type GuestResult,
  type GuestStayCard,
  type GuestStayCreate,
  type GuestWhen,
  type HallPassResult,
  type HallPermission,
  type HallRole,
  type HallUser,
  type HistoryKind,
  type HistoryResult,
  type OnboardBody,
  type PermissionCreate,
  type PermissionListResult,
  type PermissionResult,
  type PlanOutingBody,
  type ResidentHomeResult,
  type StaffFile,
  type StaffPreview,
  type StaffReply,
  type StoredSession,
} from "@/resident-client";
import { refreshEffect, registerPushToken, singleFlight } from "@/session-refresh";
import { ignore, readJson } from "@/safe";
import { trimStop } from "@/staff-gate";

export {
  errorMessage,
  hallFetch,
  type HallFailure,
} from "@/hall-http";

export type {
  CurrentOuting,
  DestinationItem,
  DestinationResult,
  GuestListResult,
  GuestResult,
  GuestStay,
  GuestStayCard,
  GuestStayCreate,
  GuestWhen,
  HallPass,
  HallPassResult,
  HallPermission,
  HallRole,
  HallUser,
  HistoryItem,
  HistoryKind,
  HistoryNoticeKind,
  HistoryResult,
  OnboardBody,
  PermissionCreate,
  PermissionKind,
  PermissionListResult,
  PermissionResult,
  PermissionStatus,
  PlanOutingBody,
  ResidentHome,
  ResidentHomeResult,
  StaffFile,
  StaffPreview,
  StaffReply,
  UpcomingOuting,
} from "@/resident-client";

export type { GuestDecision } from "@/guest-decisions";

const SESSION_KEY = "bsj.session";

type SessionValue = {
  ready: boolean;
  /** Device offers biometrics and Face ID / fingerprint sign-in is turned on. */
  biometricReady: boolean;
  /** Credentials are saved so the sign-in screen can offer Face ID / fingerprint. */
  biometricSignInAvailable: boolean;
  biometricLabel: string;
  user: HallUser | null;
  signIn: (username: string, password: string) => Promise<string | null>;
  signInWithBiometrics: () => Promise<string | null>;
  /** Turn on Face ID / fingerprint for the next sign-in. Pass the password just used when known. */
  enableBiometricSignIn: (credentials?: { username: string; password: string }) => Promise<string | null>;
  disableBiometricSignIn: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<string | null>;
  onboard: (body: OnboardBody) => Promise<string | null>;
  checkEnrolment: (enrolmentNumber: string) => Promise<string | null>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
  loadResidentHome: () => Promise<ResidentHomeResult>;
  loadDestinations: () => Promise<DestinationResult>;
  planOuting: (body: PlanOutingBody) => Promise<string | null>;
  updateOuting: (outingId: string, body: PlanOutingBody) => Promise<string | null>;
  cancelOuting: (outingId: string) => Promise<HallFailure | null>;
  loadPermissions: (offset?: number) => Promise<PermissionListResult>;
  loadPermission: (permissionId: string) => Promise<PermissionResult>;
  submitPermission: (body: PermissionCreate) => Promise<string | null>;
  updatePermission: (permissionId: string, body: PermissionCreate) => Promise<string | null>;
  cancelPermission: (permissionId: string) => Promise<HallFailure | null>;
  loadHallPass: () => Promise<HallPassResult>;
  loadHistory: (filters?: {
    kind?: HistoryKind | "all";
    from?: string | null;
    to?: string | null;
    cursor?: string | null;
  }) => Promise<HistoryResult>;
  loadGuestStays: (when: GuestWhen, offset?: number) => Promise<GuestListResult>;
  loadAwaitingGuestStays: () => Promise<GuestListResult>;
  loadGuestStay: (guestStayId: string) => Promise<GuestResult>;
  submitGuestStay: (body: GuestStayCreate) => Promise<string | null>;
  updateGuestStay: (guestStayId: string, body: GuestStayCreate) => Promise<string | null>;
  cancelGuestStay: (guestStayId: string) => Promise<HallFailure | null>;
  decideGuestStay: (guestStayId: string, decision: "approved" | "rejected") => Promise<string | null>;
  /** Reads and writes under /api/v1 for any signed-in role. A body makes it a POST. Pass POST to write with no body, PATCH to update, or DELETE to remove. */
  staffRequest: (path: string, body?: unknown, method?: "POST" | "PATCH" | "DELETE") => Promise<StaffReply>;
  /** GET that returns text, such as the register CSV. */
  staffText: (path: string) => Promise<StaffReply>;
  /** POST multipart field `evidence` for a guest receipt. */
  staffFile: (path: string, file: StaffFile) => Promise<StaffReply>;
  /** GET binary evidence and keep a cache copy the screen can show. */
  staffPreview: (path: string) => Promise<StaffPreview>;
};

const SessionContext = createContext<SessionValue | null>(null);

const lockedOutingIds = new Set<string>();
let leftOutingId: string | null = null;

export function lockOuting(id: string) {
  lockedOutingIds.add(id);
}

export function noteOutingLeft(id: string) {
  leftOutingId = id;
}

export function takeOutingLeft(): string | null {
  const id = leftOutingId;
  leftOutingId = null;
  return id;
}

export function outingLocked(id: string): boolean {
  return lockedOutingIds.has(id);
}



async function readSession(): Promise<StoredSession | null> {
  const raw = await phoneGet(SESSION_KEY);
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
  const [biometricReady, setBiometricReady] = useState(false);
  const [biometricSignInAvailable, setBiometricSignInAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState("Biometrics");
  const [session, setSession] = useState<StoredSession | null>(null);
  const sessionRef = useRef(session);

  const refreshBiometricState = useCallback(async () => {
    const [available, pref, label, signInOk] = await Promise.all([
      biometricsAvailable(),
      biometricSignInEnabled(),
      biometricLabel(),
      biometricSignInReady(),
    ]);
    setBioLabel(label);
    setBiometricReady(available && pref);
    setBiometricSignInAvailable(signInOk);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const stored = await readSession();
      if (!active) {
        return;
      }
      sessionRef.current = stored;
      setSession(stored);
      await refreshBiometricState();
      if (active) {
        setReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshBiometricState]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const pushTokenRef = useRef<string | null>(null);

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
      allowReturnReminders();
      await phoneSet(SESSION_KEY, JSON.stringify(next));
      setSession(next);
      if (await biometricSignInEnabled()) {
        await saveBiometricCredentials({ username, password });
      }
      await refreshBiometricState();
      return null;
    } catch {
      return "The hall could not be reached";
    }
  }, [refreshBiometricState]);

  const signInWithBiometrics = useCallback(async () => {
    if (!(await biometricsAvailable())) {
      return "This phone has no Face ID or fingerprint set up";
    }
    const label = await biometricLabel();
    setBioLabel(label);
    const ok = await confirmBiometrics(`Sign in with ${label}`);
    if (!ok) {
      return `${label} did not sign in`;
    }
    const credentials = await readBiometricCredentials();
    if (!credentials) {
      return `Sign in with your password once to turn on ${label}`;
    }
    return signIn(credentials.username, credentials.password);
  }, [signIn]);

  const enableBiometricSignIn = useCallback(
    async (credentials?: { username: string; password: string }) => {
      if (!(await biometricsAvailable())) {
        return "This phone has no Face ID or fingerprint set up";
      }
      const label = await biometricLabel();
      setBioLabel(label);
      const ok = await confirmBiometrics(`Turn on ${label}`);
      if (!ok) {
        return `${label} was not confirmed`;
      }
      await setBiometricSignInEnabled(true);
      if (credentials) {
        await saveBiometricCredentials(credentials);
      }
      await refreshBiometricState();
      return null;
    },
    [refreshBiometricState],
  );

  const disableBiometricSignIn = useCallback(async () => {
    await clearBiometricSignIn();
    await refreshBiometricState();
  }, [refreshBiometricState]);

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
      if (response.status === 201) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const checkEnrolment = useCallback(async (enrolmentNumber: string) => {
    try {
      const response = await hallFetch("/api/v1/auth/onboard/enrolment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrolment_number: enrolmentNumber.trim() }),
      });
      if (response.status === 204) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const endSession = useCallback(async () => {
    pushTokenRef.current = null;
    await clearNotificationSurface();
    try {
      await phoneDelete(PUSH_TOKEN_KEY);
    } catch {
      // The key may already be gone.
      ignore();
    }
    sessionRef.current = null;
    setSession(null);
    forgetOfficeSettings();
    try {
      await phoneDelete(SESSION_KEY);
    } catch {
      // The key may already be gone.
      ignore();
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!sessionRef.current) {
      return "Sign in again";
    }
    try {
      const response = await authorized("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (response.status === 204) {
        await clearBiometricSignIn();
        await refreshBiometricState();
        await endSession();
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, [endSession, refreshBiometricState]);

  const renewing = useRef<Promise<StoredSession | null> | null>(null);

  const renew = useCallback(async (): Promise<StoredSession | null> => {
    if (renewing.current) {
      return renewing.current;
    }
    return singleFlight(renewing, async (): Promise<StoredSession | null> => {
      const current = sessionRef.current;
      if (!current?.refreshToken) {
        return null;
      }
      const sent = current.refreshToken;
      let status: number | "network" = "network";
      let body: { access_token: string; refresh_token: string; user: HallUser } | null = null;
      try {
        const response = await hallFetch("/api/v1/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: sent }),
        });
        status = response.status;
        if (response.status === 200) {
          body = (await response.json()) as {
            access_token: string;
            refresh_token: string;
            user: HallUser;
          };
        }
      } catch {
        status = "network";
      }
      const effect = refreshEffect(status, sent, sessionRef.current?.refreshToken ?? null);
      if (effect === "end") {
        await endSession();
        return null;
      }
      if (effect === "keep") {
        return sessionRef.current?.refreshToken === sent ? null : sessionRef.current;
      }
      if (!body) {
        return null;
      }
      if (sessionRef.current?.refreshToken !== sent) {
        return sessionRef.current;
      }
      const next: StoredSession = {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        user: body.user,
      };
      sessionRef.current = next;
      await phoneSet(SESSION_KEY, JSON.stringify(next));
      setSession(next);
      return next;
    });
  }, [endSession]);

  const authorized = useCallback(
    async (path: string, init: RequestInit = {}): Promise<Response> => {
      const send = (token: string) => {
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${token}`);
        return hallFetch(path, { ...init, headers });
      };
      const current = sessionRef.current;
      if (!current) {
        return new Response(null, { status: 401 });
      }
      const response = await send(current.accessToken);
      if (response.status !== 401) {
        return response;
      }
      const next = await renew();
      if (!next) {
        return response;
      }
      return send(next.accessToken);
    },
    [renew],
  );

  const signOut = useCallback(async () => {
    const current = sessionRef.current;
    const token = pushTokenRef.current;
    if (current) {
      const headers = {
        Authorization: `Bearer ${current.accessToken}`,
        "Content-Type": "application/json",
      };
      try {
        if (token) {
          await hallFetch("/api/v1/devices/push-token", {
            method: "DELETE",
            headers,
            body: JSON.stringify({ token }),
          });
        }
        await hallFetch("/api/v1/auth/logout", { method: "POST", headers });
      } catch {
        // The phone still signs out when the hall cannot be reached.
        ignore();
      }
    }
    await endSession();
  }, [endSession]);

  const signedInAs = session?.user.id ?? null;

  // Ask for push after sign-in, never before. Gate staff are not asked. Android without Firebase fails quietly.
  useEffect(() => {
    const role = session?.user.role;
    if (!signedInAs || !role || role === "gate" || Platform.OS === "web") {
      return;
    }
    let active = true;
    let saved: string | null = null;
    let refused = false;

    const post = async (token: string): Promise<number | "error"> => {
      try {
        const response = await authorized("/api/v1/devices/push-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, platform: Platform.OS === "ios" ? "ios" : "android" }),
        });
        return response.status;
      } catch {
        return "error";
      }
    };

    const attempt = async (token: string) => {
      if (!active || refused) {
        return;
      }
      const outcome = await registerPushToken(token, post);
      if (!active) {
        return;
      }
      if (outcome === "refused") {
        refused = true;
        return;
      }
      if (outcome !== "saved") {
        return;
      }
      saved = token;
      pushTokenRef.current = token;
      try {
        await phoneSet(PUSH_TOKEN_KEY, token);
      } catch {
        // The next foreground tries the save again.
        ignore();
      }
    };

    const onToken = (event: { data: string }) => {
      if (event.data && event.data !== saved) {
        void attempt(event.data);
      }
    };
    let removeListener = () => {};
    try {
      removeListener = Notifications.addPushTokenListener(onToken).remove;
    } catch {
      // No push service on this phone.
      ignore();
    }

    void pushToken()
      .then((token) => {
        if (active && token) {
          return attempt(token);
        }
      })
      .catch(ignore);

    const foreground = AppState.addEventListener("change", (state) => {
      if (state !== "active" || saved || refused) {
        return;
      }
      void pushToken()
        .then((token) => {
          if (active && token) {
            return attempt(token);
          }
        })
        .catch(ignore);
    });

    return () => {
      active = false;
      removeListener();
      foreground.remove();
    };
  }, [authorized, session?.user.role, signedInAs]);

  const loadResidentHome = useCallback(async (): Promise<ResidentHomeResult> => {
    if (!sessionRef.current) {
      return { error: "Sign in again" };
    }
    try {
      const expired = await authorized("/api/v1/me/expire-passed", { method: "POST" });
      if (!expired.ok) {
        return { error: await errorMessage(expired) };
      }
      const homeResponse = await authorized("/api/v1/me/home", { method: "GET" });
      if (!homeResponse.ok) {
        return { error: await errorMessage(homeResponse) };
      }
      const home = readResidentHome(await homeResponse.json());
      if (!home) {
        return { error: "The hall could not be reached" };
      }
      let approvedPermissions: HallPermission[] | null = null;
      try {
        const gathered: HallPermission[] = [];
        let offset = 0;
        let total = 0;
        let failed = false;
        do {
          const permissions = await authorized(`/api/v1/me/permissions?status=approved&${pageQuery(offset)}`);
          if (!permissions.ok) {
            failed = true;
            break;
          }
          const body: unknown = await permissions.json();
          const page = readPermissionPage(body);
          const pageTotal = readTotal(body);
          if (!page || pageTotal === null) {
            failed = true;
            break;
          }
          gathered.push(...page);
          total = pageTotal;
          if (page.length === 0) {
            break;
          }
          offset += page.length;
        } while (offset < total);
        approvedPermissions = failed ? null : gathered;
      } catch {
        approvedPermissions = null;
      }
      return { error: null, home: { ...home, approvedPermissions } };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, [authorized]);

  const loadHistory = useCallback(
    async (filters?: {
      kind?: HistoryKind | "all";
      from?: string | null;
      to?: string | null;
      cursor?: string | null;
    }): Promise<HistoryResult> => {
      if (!sessionRef.current) {
        return { error: "Sign in again" };
      }
      const query = new URLSearchParams();
      if (filters?.kind && filters.kind !== "all") {
        query.set("kind", filters.kind);
      }
      if (filters?.from && filters.from.length > 0) {
        query.set("from", filters.from);
      }
      if (filters?.to && filters.to.length > 0) {
        query.set("to", filters.to);
      }
      if (filters?.cursor) {
        query.set("cursor", filters.cursor);
      }
      const suffix = query.toString();
      const path = suffix.length > 0 ? `/api/v1/me/history?${suffix}` : "/api/v1/me/history";
      try {
        const response = await authorized(path, { method: "GET" });
        if (!response.ok) {
          return { error: await errorMessage(response) };
        }
        const body: unknown = await response.json();
        const items = readHistory(body);
        if (!items) {
          return { error: "The hall could not be reached" };
        }
        const next = isRecord(body) && typeof body.next_cursor === "string" ? body.next_cursor : null;
        return { error: null, items, next };
      } catch {
        return { error: "The hall could not be reached" };
      }
    },
    [],
  );

  const loadGuestStays = useCallback(async (when: GuestWhen, offset = 0): Promise<GuestListResult> => {
    if (!sessionRef.current) {
      return { error: "Sign in again" };
    }
    const onePage = async (pageOffset: number): Promise<GuestListResult> => {
      const response = await authorized(`/api/v1/me/guest-stays?${guestListQuery(when, pageOffset)}`, { method: "GET" });
      if (!response.ok) {
        return { error: await errorMessage(response) };
      }
      const body: unknown = await response.json();
      const items = readGuestPage(body);
      const total = readTotal(body);
      if (!items || total === null) {
        return { error: "The hall could not be reached" };
      }
      return { error: null, items, total };
    };
    try {
      if (when !== "upcoming") {
        return await onePage(offset);
      }
      const items: GuestStayCard[] = [];
      let pageOffset = offset;
      let total = 0;
      do {
        const page = await onePage(pageOffset);
        if (page.error !== null) {
          return pageOffset === offset ? page : { error: page.error };
        }
        items.push(...page.items);
        total = page.total;
        if (page.items.length === 0) {
          break;
        }
        pageOffset += page.items.length;
      } while (pageOffset < total);
      return { error: null, items, total };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, []);

  const loadAwaitingGuestStays = useCallback(async (): Promise<GuestListResult> => {
    if (!sessionRef.current) {
      return { error: "Sign in again" };
    }
    try {
      const items: GuestStayCard[] = [];
      let offset = 0;
      let total = 0;
      do {
        const response = await authorized(
          `/api/v1/me/guest-stays/awaiting-my-approval?${pageQuery(offset)}`,
          { method: "GET" },
        );
        if (!response.ok) {
          return { error: await errorMessage(response) };
        }
        const body: unknown = await response.json();
        const page = readGuestPage(body);
        const pageTotal = readTotal(body);
        if (!page || pageTotal === null) {
          return { error: "The hall could not be reached" };
        }
        if (offset === 0) {
          total = pageTotal;
        }
        items.push(...page);
        if (page.length === 0) {
          break;
        }
        offset += page.length;
      } while (offset < total);
      return { error: null, items, total };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, []);

  const loadGuestStay = useCallback(async (guestStayId: string): Promise<GuestResult> => {
    if (!sessionRef.current) {
      return { error: "Sign in again" };
    }
    try {
      const response = await authorized(`/api/v1/me/guest-stays/${encodeURIComponent(guestStayId)}`, { method: "GET" });
      if (!response.ok) {
        return { error: await errorMessage(response) };
      }
      const stay = readGuestStay(await response.json());
      if (!stay) {
        return { error: "The hall could not be reached" };
      }
      return { error: null, stay };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, []);

  const submitGuestStay = useCallback(async (body: GuestStayCreate) => {
    if (!sessionRef.current) {
      return "Sign in again";
    }
    try {
      const response = await authorized("/api/v1/me/guest-stays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 201) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const updateGuestStay = useCallback(async (guestStayId: string, body: GuestStayCreate) => {
    if (!sessionRef.current) {
      return "Sign in again";
    }
    try {
      const response = await authorized(`/api/v1/me/guest-stays/${encodeURIComponent(guestStayId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 200) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const decideGuestStay = useCallback(async (guestStayId: string, decision: "approved" | "rejected") => {
    if (!sessionRef.current) {
      return "Sign in again";
    }
    try {
      const response = await authorized(
        `/api/v1/me/guest-stays/${encodeURIComponent(guestStayId)}/roommate-decision`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );
      if (response.status === 200) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const cancelGuestStay = useCallback(async (guestStayId: string) => {
    if (!sessionRef.current) {
      return { code: null, message: "Sign in again" };
    }
    try {
      const response = await authorized(`/api/v1/me/guest-stays/${encodeURIComponent(guestStayId)}/cancel`, { method: "POST" });
      if (response.status === 200) {
        return null;
      }
      return await hallFailure(response);
    } catch {
      return { code: null, message: "The hall could not be reached" };
    }
  }, []);

  const loadHallPass = useCallback(async (): Promise<HallPassResult> => {
    if (!sessionRef.current) {
      return { error: "Sign in again" };
    }
    try {
      const response = await authorized("/api/v1/me/hall-pass", { method: "GET" });
      if (!response.ok) {
        return { error: await errorMessage(response) };
      }
      const pass = readHallPass(await response.json());
      if (!pass) {
        return { error: "The hall could not be reached" };
      }
      return { error: null, pass };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, []);

  const loadDestinations = useCallback(async (): Promise<DestinationResult> => {
    if (!sessionRef.current) {
      return { error: "Sign in again" };
    }
    try {
      const response = await authorized("/api/v1/destinations", { method: "GET" });
      if (!response.ok) {
        return { error: await errorMessage(response) };
      }
      const items = readDestinations(await response.json());
      if (!items) {
        return { error: "The hall could not be reached" };
      }
      return { error: null, items };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, []);

  const planOuting = useCallback(async (body: PlanOutingBody) => {
    if (!sessionRef.current) {
      return "Sign in again";
    }
    try {
      const response = await authorized("/api/v1/me/outings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outingPayload(body)),
      });
      if (response.status === 201) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const updateOuting = useCallback(async (outingId: string, body: PlanOutingBody) => {
    if (!sessionRef.current) {
      return "Sign in again";
    }
    try {
      const response = await authorized(`/api/v1/me/outings/${outingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(outingPayload(body)),
      });
      if (response.status === 200) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const cancelOuting = useCallback(async (outingId: string) => {
    if (!sessionRef.current) {
      return { code: null, message: "Sign in again" };
    }
    try {
      const response = await authorized(`/api/v1/me/outings/${outingId}/cancel`, { method: "POST" });
      if (response.status === 200) {
        return null;
      }
      return await hallFailure(response);
    } catch {
      return { code: null, message: "The hall could not be reached" };
    }
  }, []);

  const loadPermissions = useCallback(async (offset = 0): Promise<PermissionListResult> => {
    if (!sessionRef.current) {
      return { error: "Sign in again" };
    }
    try {
      if (offset === 0) {
        await authorized("/api/v1/me/expire-passed", { method: "POST" });
      }
      const response = await authorized(`/api/v1/me/permissions?${pageQuery(offset)}`, { method: "GET" });
      if (!response.ok) {
        return { error: await errorMessage(response) };
      }
      const body: unknown = await response.json();
      const items = readPermissionPage(body);
      const total = readTotal(body);
      if (!items || total === null) {
        return { error: "The hall could not be reached" };
      }
      return { error: null, items, total };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, []);

  const loadPermission = useCallback(async (permissionId: string): Promise<PermissionResult> => {
    if (!sessionRef.current) {
      return { error: "Sign in again" };
    }
    try {
      await authorized("/api/v1/me/expire-passed", { method: "POST" });
      const response = await authorized(`/api/v1/me/permissions/${encodeURIComponent(permissionId)}`, { method: "GET" });
      if (!response.ok) {
        return { error: await errorMessage(response) };
      }
      const permission = readPermission(await response.json());
      if (!permission) {
        return { error: "The hall could not be reached" };
      }
      return { error: null, permission };
    } catch {
      return { error: "The hall could not be reached" };
    }
  }, []);

  const submitPermission = useCallback(async (body: PermissionCreate) => {
    if (!sessionRef.current) {
      return "Sign in again";
    }
    try {
      const response = await authorized("/api/v1/me/permissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permissionPayload(body)),
      });
      if (response.status === 201) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const updatePermission = useCallback(async (permissionId: string, body: PermissionCreate) => {
    if (!sessionRef.current) {
      return "Sign in again";
    }
    try {
      const response = await authorized(
        `/api/v1/me/permissions/${encodeURIComponent(permissionId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(permissionPayload(body)),
        },
      );
      if (response.status === 200) {
        return null;
      }
      return await errorMessage(response);
    } catch {
      return "The hall could not be reached";
    }
  }, []);

  const cancelPermission = useCallback(async (permissionId: string) => {
    if (!sessionRef.current) {
      return { code: null, message: "Sign in again" };
    }
    try {
      const response = await authorized(`/api/v1/me/permissions/${encodeURIComponent(permissionId)}/cancel`, { method: "POST" });
      if (response.status === 200) {
        return null;
      }
      return await hallFailure(response);
    } catch {
      return { code: null, message: "The hall could not be reached" };
    }
  }, []);

  const deleteAccount = useCallback(
    async (password: string) => {
      if (!sessionRef.current) {
        return "Sign in again";
      }
      try {
        const response = await authorized("/api/v1/me/account/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (response.status === 204) {
          await clearBiometricSignIn();
          await refreshBiometricState();
          await endSession();
          return null;
        }
        return await errorMessage(response);
      } catch {
        return "The hall could not be reached";
      }
    },
    [authorized, endSession, refreshBiometricState],
  );

  const staffFailure = (json: unknown): Extract<StaffReply, { ok: false }> => {
    const error = (json as { error?: { code?: unknown; message?: unknown; details?: unknown } } | null)?.error;
    return {
      ok: false,
      message: trimStop(typeof error?.message === "string" && error.message ? error.message : "The hall could not be reached"),
      details:
        error?.details && typeof error.details === "object" ? (error.details as Record<string, unknown>) : null,
      code: typeof error?.code === "string" ? error.code : null,
    };
  };

  const staffRequest = useCallback(async (path: string, body?: unknown, method?: "POST" | "PATCH" | "DELETE"): Promise<StaffReply> => {
    const unreachable = { ok: false as const, message: "The hall could not be reached", details: null, code: null };
    if (!sessionRef.current) {
      return { ...unreachable, message: "Sign in again" };
    }
    const verb = method ?? (body === undefined ? "GET" : "POST");
    try {
      const response = await authorized(
        `/api/v1${path}`,
        body === undefined
          ? { method: verb }
          : { method: verb, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      );
      if (response.status === 204) {
        return { ok: true, data: null };
      }
      const json: unknown = await readJson(response);
      if (response.ok) {
        return { ok: true, data: json };
      }
      return staffFailure(json);
    } catch {
      return unreachable;
    }
  }, []);

  const staffText = useCallback(async (path: string): Promise<StaffReply> => {
    const unreachable = { ok: false as const, message: "The hall could not be reached", details: null, code: null };
    if (!sessionRef.current) {
      return { ...unreachable, message: "Sign in again" };
    }
    try {
      const response = await authorized(`/api/v1${path}`, { method: "GET" });
      if (!response.ok) {
        return staffFailure(await readJson(response));
      }
      return { ok: true, data: await response.text() };
    } catch {
      return unreachable;
    }
  }, []);

  const staffFile = useCallback(async (path: string, file: StaffFile): Promise<StaffReply> => {
    const unreachable = { ok: false as const, message: "The hall could not be reached", details: null, code: null };
    if (!sessionRef.current) {
      return { ...unreachable, message: "Sign in again" };
    }
    try {
      const form = new FormData();
      // React Native fetch reads this shape. The hall sniffs the bytes and ignores the type.
      form.append("evidence", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
      const response = await authorized(`/api/v1${path}`, { method: "POST", body: form });
      const json: unknown = await readJson(response);
      if (response.ok) {
        return { ok: true, data: json };
      }
      return staffFailure(json);
    } catch {
      return unreachable;
    }
  }, [authorized]);

  const staffPreview = useCallback(async (path: string): Promise<StaffPreview> => {
    const unreachable = { ok: false as const, message: "The hall could not be reached", code: null };
    if (!sessionRef.current) {
      return { ...unreachable, message: "Sign in again" };
    }
    try {
      const response = await authorized(`/api/v1${path}`, { method: "GET" });
      if (!response.ok) {
        const failure = staffFailure(await readJson(response));
        return { ok: false, message: failure.message, code: failure.code };
      }
      const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream";
      const bytes = new Uint8Array(await response.arrayBuffer());
      const { File, Paths } = await import("expo-file-system");
      const ext = contentType.includes("png") ? "png" : contentType.includes("pdf") ? "pdf" : "jpg";
      const dest = new File(Paths.cache, `payment-preview.${ext}`);
      if (dest.exists) {
        dest.delete();
      }
      dest.create();
      dest.write(bytes);
      return { ok: true, uri: dest.uri, contentType };
    } catch {
      return unreachable;
    }
  }, [authorized]);

  const value = useMemo<SessionValue>(
    () => ({
      ready,
      biometricReady,
      biometricSignInAvailable,
      biometricLabel: bioLabel,
      user: session?.user ?? null,
      signIn,
      signInWithBiometrics,
      enableBiometricSignIn,
      disableBiometricSignIn,
      signOut,
      deleteAccount,
      onboard,
      checkEnrolment,
      changePassword,
      loadResidentHome,
      loadDestinations,
      planOuting,
      updateOuting,
      cancelOuting,
      loadPermissions,
      loadPermission,
      submitPermission,
      updatePermission,
      cancelPermission,
      loadHallPass,
      loadHistory,
      loadGuestStays,
      loadAwaitingGuestStays,
      loadGuestStay,
      submitGuestStay,
      updateGuestStay,
      cancelGuestStay,
      decideGuestStay,
      staffRequest,
      staffText,
      staffFile,
      staffPreview,
    }),
    [
      ready,
      biometricReady,
      biometricSignInAvailable,
      bioLabel,
      session,
      signIn,
      signInWithBiometrics,
      enableBiometricSignIn,
      disableBiometricSignIn,
      signOut,
      deleteAccount,
      onboard,
      checkEnrolment,
      changePassword,
      loadResidentHome,
      loadDestinations,
      planOuting,
      updateOuting,
      cancelOuting,
      loadPermissions,
      loadPermission,
      submitPermission,
      updatePermission,
      cancelPermission,
      loadHallPass,
      loadHistory,
      loadGuestStays,
      loadAwaitingGuestStays,
      loadGuestStay,
      submitGuestStay,
      updateGuestStay,
      cancelGuestStay,
      decideGuestStay,
      staffRequest,
      staffText,
      staffFile,
      staffPreview,
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
