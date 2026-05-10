import { useEffect, useRef } from 'react';

/**
 * Hook que atrapa el foco del teclado dentro de un modal cuando está abierto.
 * Al cerrar, restaura el foco al elemento que lo abrió.
 *
 * @param {boolean} isOpen - Controla si el trap está activo
 * @returns {React.RefObject} modalRef - Ref para asignar al contenedor del modal
 */
export function useFocusTrap(isOpen) {
  const modalRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement;
      setTimeout(() => {
        const firstButton = modalRef.current?.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        firstButton?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;
      const focusable = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => {
      document.removeEventListener('keydown', handleTab);
      triggerRef.current?.focus();
    };
  }, [isOpen]);

  return modalRef;
}
