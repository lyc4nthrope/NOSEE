import { Component } from "react";
import * as Sentry from "@sentry/react";
import { TRANSLATIONS } from "@/contexts/LanguageContext";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || TRANSLATIONS["es-MX"].errorBoundary.message,
    };
  }

  componentDidCatch(error, info) {
    Sentry.captureException(error);
    console.error("ErrorBoundary capturó un error:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <section style={styles.wrapper} role="alert" aria-live="assertive">
        <h2 style={styles.title}>Algo salió mal</h2>
        <p style={styles.text}>{this.state.message}</p>
        <p style={styles.text}>Podés recargar la página o volver al inicio.</p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
          <button type="button" style={styles.button} onClick={this.handleReload}>
            Recargar página
          </button>
          <button type="button" style={styles.buttonSecondary} onClick={this.handleGoHome}>
            Ir al inicio
          </button>
        </div>
      </section>
    );
  }
}

const styles = {
  wrapper: {
    margin: "24px",
    border: "1px solid var(--error)",
    borderRadius: "12px",
    background: "var(--error-soft)",
    padding: "18px",
    color: "var(--error)",
  },
  title: {
    margin: "0 0 8px",
    fontSize: "1.25rem",
  },
  text: {
    margin: "4px 0",
    fontSize: "0.875rem",
  },
  button: {
    border: "none",
    borderRadius: "8px",
    background: "var(--error)",
    color: "var(--text-primary)",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "0.875rem",
  },
  buttonSecondary: {
    border: "1px solid var(--error)",
    borderRadius: "8px",
    background: "transparent",
    color: "var(--error)",
    padding: "10px 14px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "0.875rem",
  },
};
