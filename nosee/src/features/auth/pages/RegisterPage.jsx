/**
 * RegisterPage - Página de registro de nuevo usuario
 */
import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useAuthStore,
  selectIsInitialized,
  selectAuthStatus,
  selectAuthError,
} from "@/features/auth/store/authStore";
import RegisterForm from "@/features/auth/components/RegisterForm";
import { resendConfirmation } from "@/services/api/auth.api";
import { useLanguage } from "@/contexts/LanguageContext";
import { getRolePath } from "@/utils/roleUtils";
import {
  trackRegisterComplete,
  trackRegisterFailure,
} from "@/services/analytics";
import { recordRegisterDuration, recordRegistrationStarted, recordRegistrationCompleted } from "@/services/metrics";

// Vista de verificación de email
function VerificationView({ email, onResend }) {
  const { t } = useLanguage();
  const tr = t.registerPage;
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    setResending(true);
    await onResend(email);
    setResending(false);
    setResent(true);
    setTimeout(() => setResent(false), 5000);
  };

  return (
    <div
      style={{
        textAlign: "center",
        padding: "16px 0",
        animation: "fadeIn 0.3s ease",
      }}
    >
      <div
        style={{
          width: "72px",
          height: "72px",
          background: "var(--accent-soft)",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 20px",
          fontSize: "28px",
        }}
      >
        ✉️
      </div>
      <h2
        style={{
          fontSize: "20px",
          fontWeight: "700",
          marginBottom: "10px",
          color: "var(--text-primary)",
        }}
      >
        {tr.verifyTitle}
      </h2>
      <p
        style={{
          fontSize: "14px",
          color: "var(--text-secondary)",
          lineHeight: "1.6",
          marginBottom: "8px",
        }}
      >
        {tr.verifySent}
      </p>
      <p
        style={{
          fontWeight: "600",
          color: "var(--accent)",
          marginBottom: "20px",
          fontSize: "15px",
        }}
      >
        {email}
      </p>
      <p
        style={{
          fontSize: "13px",
          color: "var(--text-muted)",
          lineHeight: "1.6",
          marginBottom: "20px",
        }}
      >
        {tr.verifyInstruction}
      </p>

      {resent ? (
        <p style={{ fontSize: "13px", color: "var(--success)" }}>
          {tr.emailResent}
        </p>
      ) : (
        <button
          onClick={handleResend}
          disabled={resending}
          style={{
            background: "none",
            border: "1px solid var(--border-soft)",
            color: "var(--accent)",
            borderRadius: "var(--radius-md)",
            padding: "8px 18px",
            fontSize: "13px",
            cursor: resending ? "not-allowed" : "pointer",
            opacity: resending ? 0.6 : 1,
          }}
        >
          {resending ? tr.resending : tr.resendEmail}
        </button>
      )}
    </div>
  );
}

export default function RegisterPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showTermsNotice = searchParams.get('motivo') === 'terminos';
  const register = useAuthStore((s) => s.register);
  const clearError = useAuthStore((s) => s.clearError);
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const status = useAuthStore(selectAuthStatus);
  const error = useAuthStore(selectAuthError);
  const isAuthenticated = useAuthStore((s) => !!s.user && !!s.session);
  const isInitialized = useAuthStore(selectIsInitialized);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  // Timestamp de apertura del formulario (para medir tiempo de registro)
  const formOpenedAt = useRef(Date.now());

  // Métrica: inicio del flujo de registro (denominador para conversión)
  useEffect(() => {
    recordRegistrationStarted();
  }, []);

  // Solo redirigir si ya terminó la inicialización y está logueado
  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      const user = useAuthStore.getState().user;
      navigate(getRolePath(user?.role), { replace: true });
    }
  }, [isInitialized, isAuthenticated, navigate]);

  const handleRegister = async (email, password, metadata) => {
    clearError();
    const result = await register(email, password, metadata);
    if (result.success) {
      // Métrica: tiempo promedio de registro (sección 3.4.1, meta: <45s)
      const durationSeconds = (Date.now() - formOpenedAt.current) / 1000;
      trackRegisterComplete(durationSeconds);
      recordRegisterDuration(durationSeconds);
      recordRegistrationCompleted();

      if (result.needsVerification) {
        setRegisteredEmail(email);
        setNeedsVerification(true);
      } else {
        const user = useAuthStore.getState().user;
        navigate(getRolePath(user?.role), { replace: true });
      }
    } else {
      trackRegisterFailure(result.error?.code ?? 'unknown');
    }
  };

  const handleGoogleRegister = async () => {
    clearError();
    await loginWithGoogle();
  };

  return (
    <main
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        minHeight: "calc(100vh - 60px)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          animation: "fadeIn 0.35s ease",
        }}
      >
        {/* Banner: redirigido por no aceptar términos en Google OAuth */}
        {showTermsNotice && (
          <div
            role="alert"
            style={{
              marginBottom: '20px',
              padding: '14px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--accent-soft)',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
              fontSize: '13px',
              lineHeight: '1.55',
            }}
          >
            <strong style={{ display: 'block', marginBottom: '4px' }}>
              Necesitás aceptar los Términos de uso
            </strong>
            Para crear tu cuenta con Google debés leer y aceptar los Términos de uso
            y la Política de privacidad. Tildá el casillero antes de continuar.
          </div>
        )}

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              fontSize: "32px",
              fontWeight: "800",
              letterSpacing: "-0.04em",
              color: "var(--accent)",
              marginBottom: "8px",
            }}
          >
            NØ<span style={{ color: "var(--text-secondary)" }}>SEE</span>
          </div>
          <h1
            style={{
              fontSize: "22px",
              fontWeight: "700",
              color: "var(--text-primary)",
              marginBottom: "6px",
            }}
          >
            {t.registerPage.title}
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-secondary)" }}>
            {t.registerPage.subtitle}
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            padding: "28px",
          }}
        >
          {needsVerification ? (
            <VerificationView
              email={registeredEmail}
              onResend={resendConfirmation}
            />
          ) : (
            <RegisterForm
              onSubmit={handleRegister}
              onGoogleRegister={handleGoogleRegister}
              loading={status === "loading"}
              error={error}
            />
          )}
        </div>
      </div>
    </main>
  );
}
