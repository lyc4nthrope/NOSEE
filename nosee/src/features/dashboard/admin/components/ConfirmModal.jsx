import { useEffect } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false, actions }) {
  const modalRef = useFocusTrap(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div role="presentation" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onCancel}>
      <div ref={modalRef}
        role="dialog" aria-modal="true" aria-labelledby="confirm-title"
        style={{
          background: '#fff', color: 'var(--text-primary)', borderRadius: 8, padding: 24,
          minWidth: 320, maxWidth: 480,
        }} onClick={e => e.stopPropagation()}>
        <h3 id="confirm-title" style={{ margin: '0 0 8px' }}>{title}</h3>
        <p style={{ margin: '0 0 20px' }}>{message}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {actions ? (
            <>
              {actions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => { action.onClick?.(); onCancel(); }}
                  style={{
                    ...(action.danger ? { backgroundColor: '#dc3545', color: '#fff' } : {}),
                    padding: '6px 14px', borderRadius: 6, border: '1px solid #ccc',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  {action.label}
                </button>
              ))}
              <button
                onClick={onCancel}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ccc', background: 'none', cursor: 'pointer', fontSize: 13 }}
              >
                {cancelLabel}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onCancel}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ccc', background: 'none', cursor: 'pointer', fontSize: 13 }}
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                style={{
                  padding: '6px 14px', borderRadius: 6, border: '1px solid #ccc',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  ...(danger ? { backgroundColor: '#dc3545', color: '#fff', borderColor: '#dc3545' } : {}),
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
