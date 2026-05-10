import { useFocusTrap } from '../hooks/useFocusTrap';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Modal de confirmación de baneo ──────────────────────────────────────────
export function BanModal({ user, onConfirm, onCancel }) {
  const modalRef = useFocusTrap(true);
  const { t } = useLanguage();
  const td = t.adminDashboard;
  const isBanning = user.status === 'activo';
  return (
    <div role="presentation" style={{
      position: 'fixed', inset: 0, background: 'var(--overlay)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="ban-modal-title" style={{
        background: 'var(--bg-surface)', border: '1px solid #1E2D4A', borderRadius: 14,
        padding: '28px 32px', width: 420, maxWidth: '90vw',
      }}>
        <h2 id="ban-modal-title" style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
          {isBanning ? td.banTitle : td.unbanTitle}
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-secondary)' }}>
          {isBanning
            ? <>{td.banDesc1} <strong style={{ color: 'var(--text-primary)' }}>{user.name}</strong>{td.banDesc2} <strong style={{ color: 'var(--error)' }}>{td.banDescStrong}</strong>{td.banDesc3}</>
            : <>{td.unbanDesc1} <strong style={{ color: 'var(--text-primary)' }}>{user.name}</strong>{td.unbanDesc2}</>
          }
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ background: 'none', border: '1px solid #1E2D4A', color: 'var(--text-secondary)', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}
          >
            {td.cancelBtn}
          </button>
          <button
            onClick={onConfirm}
            style={{
              background: isBanning ? 'var(--error-soft)' : 'var(--success-soft)',
              border: `1px solid ${isBanning ? 'var(--error)' : 'var(--success)'}`,
              color: isBanning ? 'var(--error)' : 'var(--success)',
              borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer', fontWeight: 600,
            }}
          >
            {isBanning ? td.confirmBanBtn : td.confirmUnbanBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BanModal;
