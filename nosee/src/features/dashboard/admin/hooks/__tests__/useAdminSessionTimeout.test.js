import { renderHook, act } from '@testing-library/react';
import { useAdminSessionTimeout } from '../useAdminSessionTimeout';
import { supabase } from '@/services/supabase.client';

vi.mock('@/services/supabase.client', () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
    },
  },
}));

describe('useAdminSessionTimeout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Mock window.location
    Object.defineProperty(window, 'location', {
      value: { href: '/admin' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registra y limpia event listeners de actividad', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useAdminSessionTimeout());

    expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('click', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
  });

  it('NO cierra sesión si hay actividad reciente', () => {
    renderHook(() => useAdminSessionTimeout());

    // Avanzar 25 minutos (menos del timeout de 30)
    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000);
    });

    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it('cierra sesión después de 30 min de inactividad', () => {
    renderHook(() => useAdminSessionTimeout());

    // Avanzar más de 30 minutos sin actividad
    act(() => {
      vi.advanceTimersByTime(31 * 60 * 1000);
    });

    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('resetea el timer si hay actividad del usuario', () => {
    renderHook(() => useAdminSessionTimeout());

    // Avanzar 25 min (aún no timeout)
    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000);
    });

    // Simular actividad (mousemove)
    act(() => {
      window.dispatchEvent(new MouseEvent('mousemove'));
    });

    // Avanzar otros 25 min desde la actividad (total 50, pero solo 25 desde última actividad)
    act(() => {
      vi.advanceTimersByTime(25 * 60 * 1000);
    });

    // Todavía no debería haber timeout porque solo pasaron 25 min desde la última actividad
    expect(supabase.auth.signOut).not.toHaveBeenCalled();

    // Avanzar otros 10 min (total 35 desde última actividad → excede 30)
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000);
    });

    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('limpia el intervalo al desmontar', () => {
    const clearSpy = vi.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() => useAdminSessionTimeout());
    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });
});
