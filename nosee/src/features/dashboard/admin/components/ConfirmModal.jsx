import { useEffect, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false, actions }) {
  const modalRef = useFocusTrap(isOpen);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onCancelRef.current(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div role="presentation" className="admin-modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'var(--overlay)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onCancel}>
      <div ref={modalRef}
        role="dialog" aria-modal="true" aria-labelledby="confirm-title"
        style={{
          background: 'var(--bg-surface)', color: 'var(--text-primary)', borderRadius: 8, padding: 24,
          minWidth: 320, maxWidth: 480,
        }} onClick={e => e.stopPropagation()}>
        <h3 id="confirm-title" style={{ margin: '0 0 8px' }}>{title}</h3>
        <p style={{ margin: '0 0 20px' }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {actions ? (
            <>
              {actions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => { action.onClick?.(); onCancel(); }}
                  style={{
                    ...(action.danger ? { backgroundColor: 'var(--error)', color: '#fff' } : {}),
                    padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)',
                    cursor: 'pointer', fontSize: 'var(--admin-fs-base)', fontWeight: 600,
                  }}
                >
                  {action.label}
                </button>
              ))}
              <button
                onClick={onCancel}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 'var(--admin-fs-base)' }}
              >
                {cancelLabel}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onCancel}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: 'var(--admin-fs-base)' }}
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)',
                  cursor: 'pointer', fontSize: 'var(--admin-fs-base)', fontWeight: 600,
                  ...(danger ? { backgroundColor: 'var(--error)', color: '#fff', borderColor: 'var(--error)' } : {}),
                }}
              >
                {confirmLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
