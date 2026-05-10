import { Spinner } from '@/components/ui/Spinner';
import { useLanguage } from '@/contexts/LanguageContext';
import { s, MUTED } from '../adminStyles';

export function DetailRow({ label, value }) {
  const isUrl = typeof value === 'string' && value.startsWith('http');
  return (
    <div style={s.detailRow}>
      <span style={s.detailLabel}>{label}</span>
      {isUrl ? <a href={value} target="_blank" rel="noreferrer" style={s.linkBtn}>{value}</a> : <span>{value}</span>}
    </div>
  );
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────
export function SectionHeader({ title, sub }) {
  return (
    <header style={s.header}>
      <h1 style={s.headerTitle}>{title}</h1>
      <p style={s.headerSub}>{sub}</p>
    </header>
  );
}

export function StatusBadge({ status }) {
  const { t } = useLanguage();
  const td = t.adminDashboard;
  const map = {
    active:   { bg: 'var(--success-soft)', color: 'var(--success)', label: td.pubStatusActive },
    hidden:   { bg: 'var(--error-soft)', color: 'var(--error)', label: td.pubHiddenStatus },
    pending:  { bg: 'var(--warning-soft)', color: 'var(--warning)', label: td.pubStatusPending },
    rejected: { bg: 'var(--error-soft)', color: 'var(--error)', label: td.pubStatusRejected },
    expired:  { bg: 'var(--info-soft)', color: 'var(--text-muted)', label: td.pubStatusExpired },
  };
  const c = map[status] || map.pending;
  return (
    <span style={{ ...s.badge, background: c.bg, color: c.color, fontSize: 10, marginTop: 2 }}>
      {c.label}
    </span>
  );
}

export function LoadingState({ label }) {
  return (
    <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 12 }}>
      <Spinner size={28} />
      {label && <p style={{ color: MUTED, fontSize: 14, margin: 0 }}>{label}</p>}
    </div>
  );
}

export function EmptyMsg({ text }) {
  return (
    <div style={{ padding: '48px 20px', textAlign: 'center', color: MUTED, fontSize: 14 }}>
      {text}
    </div>
  );
}

export function ErrorBar({ msg, onRetry }) {
  const { t } = useLanguage();
  const td = t.adminDashboard;
  return (
    <div role="alert" aria-live="assertive" style={{
      padding: '12px 16px',
      borderRadius: 'var(--radius-md, 8px)',
      background: 'var(--error-soft)',
      border: '1px solid rgba(248,113,113,0.25)',
      color: 'var(--error)',
      fontSize: 13,
      marginBottom: 20,
    }}>
      <span aria-hidden="true">⚠️</span> {msg}
      <button onClick={onRetry} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', textDecoration: 'underline', marginLeft: 12, fontWeight: 600 }}>
        {td.retry}
      </button>
    </div>
  );
}
