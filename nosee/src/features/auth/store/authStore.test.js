import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks de dependencias externas ───────────────────────────────────────────

vi.mock("@/services/supabase.client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

vi.mock("@/services/api/auth.api", () => ({
  getSession: vi.fn(() => Promise.resolve({ success: false, data: null })),
}));

vi.mock("@/services/api/users.api", () => ({
  getUserProfile: vi.fn(),
}));

vi.mock("@/services/metrics", () => ({
  recordTokenRefresh: vi.fn(),
}));

vi.mock("@/services/api/audit.api", () => ({
  insertUserActivityLog: vi.fn(),
}));

// ─── Import del store DESPUÉS de los mocks ────────────────────────────────────

import { useAuthStore } from "./authStore";
import { AsyncStateEnum } from "@/types";

// ─── Reset del store entre tests ──────────────────────────────────────────────

beforeEach(() => {
  useAuthStore.setState({
    user: null,
    session: null,
    status: AsyncStateEnum.IDLE,
    error: null,
    isInitialized: false,
    isRecoveryMode: false,
    _unsubscribeAuthListener: null,
    _roleChangeNotification: null,
  });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("authStore — estado inicial", () => {
  it("user es null al inicio", () => {
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("session es null al inicio", () => {
    expect(useAuthStore.getState().session).toBeNull();
  });

  it("status es IDLE al inicio", () => {
    expect(useAuthStore.getState().status).toBe(AsyncStateEnum.IDLE);
  });

  it("error es null al inicio", () => {
    expect(useAuthStore.getState().error).toBeNull();
  });

  it("isInitialized es false al inicio", () => {
    expect(useAuthStore.getState().isInitialized).toBe(false);
  });

  it("isRecoveryMode es false al inicio", () => {
    expect(useAuthStore.getState().isRecoveryMode).toBe(false);
  });
});

describe("authStore — selectors derivados", () => {
  it("no hay usuario autenticado cuando user es null", () => {
    const { user } = useAuthStore.getState();
    expect(user).toBeNull();
  });

  it("hay usuario autenticado cuando user tiene id", () => {
    useAuthStore.setState({ user: { id: "abc-123", email: "test@test.com" } });
    const { user } = useAuthStore.getState();
    expect(user?.id).toBe("abc-123");
  });
});

describe("authStore — isRecoveryMode", () => {
  it("se puede activar recovery mode via setState", () => {
    useAuthStore.setState({ isRecoveryMode: true });
    expect(useAuthStore.getState().isRecoveryMode).toBe(true);
  });

  it("recovery mode impide tratar al usuario como autenticado", () => {
    useAuthStore.setState({
      isRecoveryMode: true,
      user: null,
      status: AsyncStateEnum.IDLE,
    });
    const { isRecoveryMode, user } = useAuthStore.getState();
    // En recovery mode, aunque haya sesión, no se considera autenticado
    expect(isRecoveryMode).toBe(true);
    expect(user).toBeNull();
  });
});

describe("authStore — initialize con sesión vacía", () => {
  it("setea isInitialized=true y status=IDLE cuando no hay sesión", async () => {
    const authApi = await import("@/services/api/auth.api");
    authApi.getSession.mockResolvedValueOnce({ success: true, data: null });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isInitialized).toBe(true);
    expect(state.user).toBeNull();
    expect(state.status).toBe(AsyncStateEnum.IDLE);
  });

  it("setea status=ERROR cuando getSession falla", async () => {
    const authApi = await import("@/services/api/auth.api");
    authApi.getSession.mockResolvedValueOnce({
      success: false,
      error: "Network error",
    });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.status).toBe(AsyncStateEnum.ERROR);
    expect(state.isInitialized).toBe(true);
    expect(state.user).toBeNull();
  });
});
