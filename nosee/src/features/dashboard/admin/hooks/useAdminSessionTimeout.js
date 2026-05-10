import { useEffect, useRef } from 'react';
import { supabase } from '@/services/supabase.client';

const IDLE_TIMEOUT = 30 * 60 * 1000;
const CHECK_INTERVAL = 60 * 1000;

/**
 * Hook que cierra la sesión del admin después de 30 minutos de inactividad.
 * Monitorea eventos de mouse, teclado, click y scroll para resetear el timer.
 */
export function useAdminSessionTimeout() {
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const updateActivity = () => { lastActivity.current = Date.now(); };
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity, { passive: true });

    const interval = setInterval(async () => {
      const idle = Date.now() - lastActivity.current;
      if (idle > IDLE_TIMEOUT) {
        console.warn('[Session] Admin inactivo 30 min — cerrando sesión');
        await supabase.auth.signOut();
        window.location.href = '/login';
      }
    }, CHECK_INTERVAL);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      clearInterval(interval);
    };
  }, []);
}
