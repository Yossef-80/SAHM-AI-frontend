import { create } from "zustand";
import type { AuthSession, AuthUser, Role, SessionInfo, WorkspaceMembership } from "@/types";

/**
 * Session state (P1.8).
 *
 * Where the access token lives, and why
 * --------------------------------------
 * `sessionStorage`, not `localStorage`, and not a cookie.
 *
 * - **Not `localStorage`**: the token survives the tab closing and is readable by
 *   any script that ever runs on this origin, forever. A persistent bearer token
 *   in `localStorage` is the single most common XSS exfiltration target in a
 *   React app. `sessionStorage` is still XSS-readable — **that tradeoff is real
 *   and accepted**: the mitigating factor is that the token dies with the tab,
 *   so a drive-by script has a window of minutes rather than weeks.
 * - **Not a cookie**: the backend (P1.2) returns the token in the JSON body and
 *   reads it from `Authorization`, explicitly *not* from a cookie, because the
 *   browser talks to FastAPI cross-origin with no proxy in front. Putting it in
 *   a cookie would not protect it from XSS either (`document.cookie` is readable
 *   unless `HttpOnly`, and then the backend could not use it anyway).
 * - The real fix for XSS is a `HttpOnly; Secure; SameSite=Lax` refresh cookie
 *   issued by the backend, with the access token kept in memory only. That is
 *   P1.2's "recommended" design; the shipped `/auth/refresh` takes the token in a
 *   body field instead, so this store is the compromise that matches the
 *   contract we actually have. Revisit when the backend sets the cookie.
 *
 * `middleware.ts` cannot read `sessionStorage`, so we also drop a **non-secret**
 * presence marker as a session cookie (`sahm_session=1`). It carries no token,
 * only the fact that one exists; it is used purely for the redirect UX. The real
 * authentication is always the API's `401`.
 */

const TOKEN_KEY = "sahm.access_token";

/** Non-secret presence marker read by `middleware.ts`. Session cookie by design (no Max-Age). */
export const SESSION_MARKER_COOKIE = "sahm_session";

const hasWindow = typeof window !== "undefined";

function readToken(): string | null {
  if (!hasWindow) return null;
  try {
    return window.sessionStorage.getItem(TOKEN_KEY);
  } catch {
    // Private-mode Safari / disabled storage: fall back to memory-only sessions.
    return null;
  }
}

function writeToken(token: string | null): void {
  if (!hasWindow) return;
  try {
    if (token) window.sessionStorage.setItem(TOKEN_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable — the in-memory copy still drives this tab */
  }
}

function setMarker(on: boolean): void {
  if (!hasWindow) return;
  if (on) {
    document.cookie = `${SESSION_MARKER_COOKIE}=1; path=/; SameSite=Lax`;
  } else {
    document.cookie = `${SESSION_MARKER_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
  }
}

export type AuthStatus = "unknown" | "anonymous" | "authenticated";

interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  user: AuthUser | null;
  workspaces: WorkspaceMembership[];
  /**
   * Drives the `X-Workspace-Id` header.
   *
   * Careful: despite the name, this is a **business id** (`biz_...`), not the
   * `ws_...` workspace id. The backend says so twice — `WORKSPACE_HEADER` is
   * documented as "carries a `businesses.id`" (`app/api/deps.py`), and
   * `_active_workspace()` returns `item.business_id`. Sending `ws_...` resolves
   * to a 404, so the portfolio switcher selects on `businessId` too.
   */
  activeWorkspaceId: string | null;
  /** Role held on `activeWorkspaceId`; gates owner-only screens. */
  activeRole: Role | null;

  /** Adopt a register/login/refresh response. */
  applySession: (session: AuthSession) => void;
  /** Adopt a `GET /auth/me` response (token untouched). */
  applySessionInfo: (info: SessionInfo) => void;
  /** Read the persisted token on boot. Safe to call on the server (no-op). */
  hydrate: () => void;
  /** Switch the active workspace; the caller invalidates the query cache. */
  selectWorkspace: (workspaceId: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "unknown",
  accessToken: null,
  user: null,
  workspaces: [],
  activeWorkspaceId: null,
  activeRole: null,

  applySession: (session) => {
    // The server sends a business id here; fall back to the primary membership.
    const activeBusinessId = session.activeWorkspaceId ?? session.workspaces.find((w) => w.isPrimary)?.businessId ?? null;
    set({
      status: "authenticated",
      accessToken: session.accessToken,
      user: session.user,
      workspaces: session.workspaces,
      activeWorkspaceId: activeBusinessId,
      activeRole: session.workspaces.find((w) => w.businessId === activeBusinessId)?.role ?? null,
    });
  },

  applySessionInfo: (info) => {
    const activeBusinessId = info.activeWorkspaceId ?? get().activeWorkspaceId;
    set({
      status: "authenticated",
      user: info.user,
      workspaces: info.workspaces,
      activeWorkspaceId: activeBusinessId,
      activeRole: info.activeRole,
    });
  },

  hydrate: () => {
    if (get().status !== "unknown") return;
    let token = readToken();
    // Previous Supabase sessions are JWTs; the app's original sessions are
    // opaque random values. Never send a stale Supabase JWT to legacy endpoints.
    if (token && token.split(".").length === 3) {
      token = null;
      writeToken(null);
      setMarker(false);
    }
    set({ status: token ? "authenticated" : "anonymous", accessToken: token });
    if (token) setMarker(true);
  },

  /** Takes a **business id** — the value `X-Workspace-Id` expects. */
  selectWorkspace: (businessId) => {
    const { workspaces } = get();
    const target = workspaces.find((w) => w.businessId === businessId);
    if (!target) return;
    set({ activeWorkspaceId: businessId, activeRole: target.role });
  },

  clear: () => {
    writeToken(null);
    setMarker(false);
    set({ status: "anonymous", accessToken: null, user: null, workspaces: [], activeWorkspaceId: null, activeRole: null });
  },
}));

/**
 * Side-effect-free persistence: called after every mutation that changes the
 * token. Kept out of the actions so `selectWorkspace` never rewrites storage.
 */
function persist(state: AuthState): void {
  writeToken(state.accessToken);
  setMarker(Boolean(state.accessToken));
}

let lastPersisted: string | null = null;
useAuthStore.subscribe((state) => {
  if (state.accessToken === lastPersisted) return;
  lastPersisted = state.accessToken;
  persist(state);
});

/* ------------------------------------------------------------------ */
/* Module-level accessors for the API layer                            */
/* `HttpApi` is a plain class, not a React component, so it reads the   */
/* store through `getState()` rather than through a hook.             */
/* ------------------------------------------------------------------ */

export const getAccessToken = (): string | null => useAuthStore.getState().accessToken;
export const getActiveWorkspaceId = (): string | null => useAuthStore.getState().activeWorkspaceId;
export const getActiveRole = (): Role | null => useAuthStore.getState().activeRole;

/** Replace only the token (used by the silent refresh path). */
export function applyRefreshedSession(session: AuthSession): void {
  useAuthStore.getState().applySession(session);
}

export function endSession(): void {
  useAuthStore.getState().clear();
}
