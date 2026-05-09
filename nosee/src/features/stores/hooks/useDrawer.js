import { useState, useRef, useCallback, useEffect } from 'react';

export const DRAWER_PEEK_PX  = 72;
const HALF_VH        = 0.45;
const FULL_VH        = 0.92;
const DRAG_THRESHOLD = 8; // px — minimum movement before considered a drag

function getSnapHeight(snap) {
  const vh = window.innerHeight;
  if (snap === 'peek') return DRAWER_PEEK_PX;
  if (snap === 'half') return Math.round(vh * HALF_VH);
  return Math.round(vh * FULL_VH);
}

function nearestSnap(h) {
  const vh = window.innerHeight;
  const candidates = {
    peek: DRAWER_PEEK_PX,
    half: Math.round(vh * HALF_VH),
    full: Math.round(vh * FULL_VH),
  };
  return Object.entries(candidates)
    .sort(([, a], [, b]) => Math.abs(h - a) - Math.abs(h - b))[0][0];
}

function applyHeight(el, h, animated) {
  if (!el) return;
  el.style.transition = animated
    ? 'height 0.3s cubic-bezier(0.32,0.72,0,1)'
    : 'none';
  el.style.height = `${h}px`;
}

export function useDrawer(drawerRef) {
  const [snap, setSnapState] = useState('peek');

  const currentH    = useRef(DRAWER_PEEK_PX);
  const dragStartY  = useRef(null);
  const dragStartH  = useRef(null);
  const isDragging  = useRef(false);

  // Sync snap state → drawer height (animated)
  useEffect(() => {
    const h = getSnapHeight(snap);
    currentH.current = h;
    applyHeight(drawerRef.current, h, true);
  }, [snap, drawerRef]);

  const snapTo = useCallback((newSnap) => {
    setSnapState(newSnap);
  }, []);

  const cycleSnap = useCallback(() => {
    setSnapState(prev => prev === 'peek' ? 'half' : prev === 'half' ? 'full' : 'peek');
  }, []);

  const onPointerDown = useCallback((e) => {
    // Don't capture if the user is interacting with a link or input.
    // Buttons are also excluded UNLESS they carry data-drag-handle (e.g. the handle pill).
    if (e.target.closest('a, input')) return;
    if (e.target.closest('button') && !e.target.closest('[data-drag-handle]')) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    dragStartH.current = currentH.current;
    isDragging.current = false;
    applyHeight(drawerRef.current, currentH.current, false);
  }, [drawerRef]);

  const onPointerMove = useCallback((e) => {
    if (dragStartY.current === null) return;

    const delta = dragStartY.current - e.clientY;
    if (!isDragging.current && Math.abs(delta) > DRAG_THRESHOLD) {
      isDragging.current = true;
    }
    if (!isDragging.current) return;

    const maxH = window.innerHeight * 0.96;
    const newH = Math.max(DRAWER_PEEK_PX, Math.min(dragStartH.current + delta, maxH));
    currentH.current = newH;
    applyHeight(drawerRef.current, newH, false);
  }, [drawerRef]);

  const onPointerUp = useCallback(() => {
    if (dragStartY.current === null) return;

    const wasDrag = isDragging.current;
    dragStartY.current = null;
    isDragging.current = false;

    if (wasDrag) {
      const nearest = nearestSnap(currentH.current);
      // Apply height immediately (animated) then sync state
      const snapH = getSnapHeight(nearest);
      currentH.current = snapH;
      applyHeight(drawerRef.current, snapH, true);
      setSnapState(nearest);
    } else {
      cycleSnap();
    }
  }, [drawerRef, cycleSnap]);

  return { snap, snapTo, cycleSnap, onPointerDown, onPointerMove, onPointerUp };
}
