/**
 * App.jsx
 */
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import {
  useAuthStore,
  selectIsInitialized,
  selectAuthUser,
  selectIsAuthenticated,
} from "@/features/auth/store/authStore";
const ChatWidget = lazy(() => import("@/features/chat/components/ChatWidget"));
import { useShoppingListStore } from "@/features/shopping-list/store/shoppingListStore";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { PageLoader } from "@/components/ui/Spinner";
import ErrorBoundary from "@/components/ErrorBoundary";
import AccessibilityMenu from "@/components/layout/AccessibilityMenu";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { usePageView } from "@/hooks/usePageView";

const HomePage = lazy(() => import("@/pages/HomePage"));
const LoginPage = lazy(() => import("@/features/auth/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/features/auth/pages/RegisterPage"));
const CallbackPage = lazy(() => import("@/features/auth/pages/CallbackPage"));
const ForgotPasswordPage = lazy(
  () => import("@/features/auth/pages/ForgotPasswordPage")
);
const NewPasswordPage = lazy(
  () => import("@/features/auth/pages/NewPasswordPage")
);
const ProfilePage = lazy(() => import("@/features/auth/pages/ProfilePage"));

const RoleRouter = lazy(() => import("@/router/RoleRouter"));
const AdminDashboard = lazy(
  () => import("@/features/dashboard/admin/AdminDashboard")
);
const ModeratorDashboard = lazy(
  () => import("@/features/dashboard/moderator/ModeratorDashboard")
);
const DealerDashboard = lazy(
  () => import("@/features/dashboard/dealer/DealerDashboard")
);

const CreatePublicationPage = lazy(
  () => import("@/features/publications/pages/CreatePublicationPage")
);
const EditPublicationPage = lazy(
  () => import("@/features/publications/pages/EditPublicationPage")
);
const PublicationDetailPage = lazy(
  () => import("@/features/publications/pages/PublicationDetailPage")
);
const CreateStorePage = lazy(
  () => import("@/features/stores/pages/CreateStorePage")
);
const EditStorePage = lazy(
  () => import("@/features/stores/pages/EditStorePage")
);
const StoresPage = lazy(
  () => import("@/features/stores/pages/StoresPage")
);
const NearbyStoresPage = lazy(
  () => import("@/features/stores/pages/NearbyStoresPage")
);
const RankingPage = lazy(() => import("@/pages/RankingPage"));
const TermsPage = lazy(() => import("@/pages/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/PrivacyPage"));
const ShoppingListPage = lazy(
  () => import("@/features/shopping-list/pages/ShoppingListPage")
);
const CreateOrderPage = lazy(
  () => import("@/features/orders/pages/CreateOrderPage")
);
const OrderDetailPage = lazy(
  () => import("@/features/orders/pages/OrderDetailPage")
);

function NotFoundPage() {
  const { t } = useLanguage();
  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        textAlign: "center",
        gap: "16px",
      }}
    >
      <div style={{ fontSize: "72px", lineHeight: 1 }}>🔍</div>
      <h1
        style={{
          fontSize: "1.75rem",
          fontWeight: "800",
          color: "var(--text-primary)",
        }}
      >
        404
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
        {t.app.notFound}
      </p>
      <a
        href="/"
        style={{
          padding: "8px 20px",
          background: "var(--accent-soft)",
          color: "var(--accent)",
          borderRadius: "var(--radius-md)",
          fontSize: "0.875rem",
          fontWeight: "500",
          textDecoration: "none",
        }}
      >
        {t.app.backHome}
      </a>
    </main>
  );
}

function AppContent() {
  const { initialize } = useAuthStore();
  const isInitialized = useAuthStore(selectIsInitialized);

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!isInitialized) {
    return <PageLoader message="Loading..." />;
  }

  return (
    <Suspense fallback={<PageLoader message="Loading..." />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/auth/callback" element={<CallbackPage />} />
        <Route path="/recuperar-contrasena" element={<ForgotPasswordPage />} />
        <Route path="/nueva-contrasena" element={<NewPasswordPage />} />

        <Route path="/" element={<HomePage />} />
        <Route path="/ranking" element={<RankingPage />} />
        <Route path="/terminos" element={<TermsPage />} />
        <Route path="/privacidad" element={<PrivacyPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <RoleRouter />
            </ProtectedRoute>
          }
        />

        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/publicaciones"
          element={<Navigate to="/" replace />}
        />

        <Route
          path="/publicaciones/nueva"
          element={
            <ProtectedRoute>
              <CreatePublicationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/publicaciones/editar/:id"
          element={
            <ProtectedRoute>
              <EditPublicationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/publicaciones/:id"
          element={<PublicationDetailPage />}
        />

        <Route
          path="/tiendas/cercanas"
          element={
            <ProtectedRoute>
              <NearbyStoresPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tiendas/nueva"
          element={
            <ProtectedRoute>
              <CreateStorePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tiendas/editar/:id"
          element={
            <ProtectedRoute>
              <EditStorePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/tiendas"
          element={<StoresPage />}
        />

        <Route
          path="/lista"
          element={<ShoppingListPage />}
        />
        <Route
          path="/pedido/nuevo"
          element={
            <ProtectedRoute>
              <CreateOrderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/pedido/:id"
          element={
            <ProtectedRoute>
              <OrderDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute allowedRoles={["Admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/moderator"
          element={
            <ProtectedRoute allowedRoles={["Moderador", "Admin"]}>
              <ModeratorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/dealer"
          element={
            <ProtectedRoute allowedRoles={["Repartidor"]}>
              <DealerDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

function ConnectionErrorView() {
  const { t } = useLanguage();

  return (
    <section
      role="alert"
      aria-live="assertive"
      style={{
        margin: "24px",
        borderRadius: "12px",
        border: "1px solid var(--error)",
        background: "var(--error-soft)",
        color: "var(--error)",
        padding: "20px",
        display: "grid",
        gap: "8px",
      }}
    >
      <h2 style={{ margin: 0, fontSize: "1.375rem", fontWeight: 800 }}>
        {t.app.connectionErrorTitle}
      </h2>
      <p style={{ margin: 0, color: "var(--error)" }}>{t.app.connectionErrorMessage}</p>
      <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--error)" }}>
        {t.app.connectionErrorHint}
      </p>
    </section>
  );
}

function RoleChangeToast() {
  const notification = useAuthStore((s) => s._roleChangeNotification);
  const clearRoleNotification = useAuthStore((s) => s.clearRoleNotification);
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(clearRoleNotification, 300);
  }, [clearRoleNotification]);

  useEffect(() => {
    if (!notification) return;
    const showTimer = setTimeout(() => setVisible(true), 0);
    const hideTimer = setTimeout(dismiss, 5000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [notification, dismiss]);

  if (!notification) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "fixed",
        bottom: "24px",
        right: "12px",
        background: "var(--bg-elevated)",
        color: "var(--text-primary)",
        padding: "12px 16px 12px 20px",
        borderRadius: "8px",
        fontSize: "0.875rem",
        fontWeight: 500,
        boxShadow: "var(--shadow-sm)",
        zIndex: 9999,
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s",
        maxWidth: "min(320px, calc(100vw - 24px))",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <span aria-hidden="true">🔔</span>
      <span>{t.app.roleChangePrefix} {notification}</span>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t.app.closeNotification}
        style={{
          background: "none",
          border: "none",
          color: "var(--text-primary)",
          cursor: "pointer",
          fontSize: "1rem",
          lineHeight: 1,
          padding: "4px",
          marginLeft: "auto",
          borderRadius: "4px",
          minWidth: "28px",
          minHeight: "28px",
        }}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}

/** Sincroniza el store de lista/pedidos con el usuario autenticado */
function ShoppingListSync() {
  const user = useAuthStore(selectAuthUser);
  const loadForUser = useShoppingListStore((s) => s.loadForUser);

  useEffect(() => {
    loadForUser(user?.id ?? null);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function RouteErrorBoundary() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname}>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppShell() {
  const { t } = useLanguage();
  const user = useAuthStore(selectAuthUser);
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  // Rastrear page views en cada cambio de ruta (GA4)
  usePageView();
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  useEffect(() => {
    const markOffline = () => setIsOffline(true);
    const markOnline = () => setIsOffline(false);

    window.addEventListener("offline", markOffline);
    window.addEventListener("online", markOnline);

    return () => {
      window.removeEventListener("offline", markOffline);
      window.removeEventListener("online", markOnline);
    };
  }, []);
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-base)",
      }}
    >
      <a href="#main-content" className="skip-link">
        {t.app.skipToContent}
      </a>

      <ShoppingListSync />
      <Navbar />

      <main
        id="main-content"
        tabIndex={-1}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          overflowX: "hidden",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {isOffline ? <ConnectionErrorView /> : null}
        <RouteErrorBoundary />
      </main>

      <Footer />
      <AccessibilityMenu />
      <RoleChangeToast />
      {isAuthenticated && (
        <Suspense fallback={null}>
          <ChatWidget userId={user?.id} isAuthenticated={isAuthenticated} />
        </Suspense>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AppShell />
      </LanguageProvider>
    </BrowserRouter>
  );
}
