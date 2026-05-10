import { useState, useCallback } from 'react';
import { StoreOnlyMap } from '@/features/orders/components/StoreOnlyMap';
import { parseStoreCoords } from '@/features/orders/utils/parseStoreCoords';
import { getStoreEmoji } from '@/features/shopping-list/utils/shoppingListUtils';

const MAX_GMAPS_WAYPOINTS = 8;

function buildGoogleMapsUrl(stores, userCoords) {
  const positions = stores
    .map((s) => parseStoreCoords(s.store?.location))
    .filter((p) => p?.lat && p?.lng)
    .slice(0, MAX_GMAPS_WAYPOINTS);

  if (positions.length === 0) return null;

  const destination = positions[positions.length - 1];
  const waypoints   = positions.slice(0, -1);

  let url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`;
  if (userCoords?.lat && userCoords?.lng) {
    url += `&origin=${userCoords.lat},${userCoords.lng}`;
  }
  if (waypoints.length > 0) {
    url += `&waypoints=${waypoints.map((p) => `${p.lat},${p.lng}`).join('|')}`;
  }
  return url;
}

export function VoyYoMapView({ result, userCoords, onAddProduct, checkedKeys: externalCheckedKeys, onToggleCheck }) {
  const [panelOpen, setPanelOpen]           = useState(true);
  const [internalCheckedKeys, setInternalCheckedKeys] = useState(new Set());
  const [newProductInput, setNewProductInput] = useState('');
  const [pendingProducts, setPendingProducts] = useState([]);
  // pendingProduct shape: { tempId: string, name: string, status: 'loading'|'done'|'error' }

  const controlled  = externalCheckedKeys !== undefined && onToggleCheck !== undefined;
  const checkedKeys = controlled ? externalCheckedKeys : internalCheckedKeys;

  const toggleCheck = useCallback((key) => {
    if (controlled) { onToggleCheck(key); return; }
    setInternalCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, [controlled, onToggleCheck]);

  const handleAddProduct = useCallback(() => {
    const name = newProductInput.trim();
    if (!name) return;
    const tempId = `pending-${Date.now()}`;
    setPendingProducts((prev) => [...prev, { tempId, name, status: 'loading' }]);
    setNewProductInput('');
    onAddProduct?.(name, tempId, (status) => {
      setPendingProducts((prev) => prev.map((p) => p.tempId === tempId ? { ...p, status } : p));
    });
  }, [newProductInput, onAddProduct]);

  const stores      = result?.stores ?? [];
  const totalCost   = result?.totalCost ?? 0;
  const gmapsUrl    = buildGoogleMapsUrl(stores, userCoords);
  const truncated   = stores.length > MAX_GMAPS_WAYPOINTS;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '500px', zIndex: 0 }}>
      {/* ── Mapa full-screen ── */}
      <StoreOnlyMap stores={stores} userCoords={userCoords} />

      {/* ── Panel izquierdo colapsable ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, height: '100%',
        width: panelOpen ? '300px' : '0px',
        zIndex: 1000,
        background: 'var(--bg-surface)',
        borderRight: panelOpen ? '1px solid var(--border)' : 'none',
        overflowY: panelOpen ? 'auto' : 'hidden',
        overflowX: 'hidden',
        transition: 'width 0.2s ease',
        display: 'flex', flexDirection: 'column',
      }}>
        {panelOpen && (
          <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '300px' }}>
            {/* Header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                🛒 Tu ruta de compra
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {stores.length} {stores.length === 1 ? 'tienda' : 'tiendas'} · Total: ${totalCost.toLocaleString('es-CO')} COP
              </span>
            </div>

            {/* Google Maps button */}
            {gmapsUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <a
                  href={gmapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px 14px', borderRadius: 'var(--radius-md)',
                    background: '#4285F4', color: '#fff',
                    fontSize: '13px', fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  🗺️ Abrir en Google Maps
                </a>
                {truncated && (
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Mostrando las primeras {MAX_GMAPS_WAYPOINTS} tiendas en la ruta
                  </span>
                )}
              </div>
            )}

            {/* Stores + products list */}
            {stores.map((s, si) => {
              const emoji    = getStoreEmoji(s.store?.store_type_id);
              const subtotal = s.products.reduce((a, p) => a + (p.price || 0) * (p.item?.quantity || 1), 0);
              return (
                <div key={si} style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', overflow: 'hidden',
                }}>
                  {/* Store header */}
                  <div style={{
                    padding: '8px 12px', display: 'flex', justifyContent: 'space-between',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)',
                    background: 'var(--bg-surface)',
                  }}>
                    <span>{emoji} {s.store?.name ?? 'Tienda'}</span>
                    <span style={{ color: 'var(--accent)' }}>${subtotal.toLocaleString('es-CO')}</span>
                  </div>

                  {/* Products */}
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {s.products.map((p, pi) => {
                      const ckKey  = `${si}-${pi}`;
                      const isDone = checkedKeys.has(ckKey);
                      return (
                        <li key={pi} style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '7px 12px',
                          borderBottom: pi < s.products.length - 1 ? '1px solid var(--border)' : 'none',
                          fontSize: '12px',
                        }}>
                          {/* Checkbox */}
                          <input
                            type="checkbox"
                            checked={isDone}
                            onChange={() => toggleCheck(ckKey)}
                            style={{ flexShrink: 0, cursor: 'pointer', accentColor: 'var(--accent)', width: '14px', height: '14px' }}
                          />
                          {/* Avatar */}
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                            background: 'var(--accent-soft)', border: '1px solid var(--accent)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '11px', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase',
                            overflow: 'hidden',
                          }}>
                            {p.photo_url ? (
                              <img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            ) : (
                              (p.item?.productName ?? p.productName ?? '?')[0]
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontWeight: 600, color: 'var(--text-primary)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              ...(isDone ? { opacity: 0.5, textDecoration: 'line-through' } : {}),
                            }}>
                              {p.item?.productName ?? p.productName ?? 'Producto'}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
                              ×{p.item?.quantity || 1} · ${(p.price || 0).toLocaleString('es-CO')} c/u
                            </div>
                          </div>
                          <span style={{ fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>
                            ${((p.price || 0) * (p.item?.quantity || 1)).toLocaleString('es-CO')}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}

            {/* Pending products (optimizando...) */}
            {pendingProducts.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Buscando opciones...
                </span>
                {pendingProducts.map((pp) => (
                  <div key={pp.tempId} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                  }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                      background: 'var(--accent-soft)', border: '1px solid var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase',
                    }}>
                      {pp.name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{pp.name}</div>
                      {pp.status === 'loading' && (
                        <div style={{ fontSize: '11px', color: 'var(--accent)', fontStyle: 'italic' }}>⏳ Optimizando...</div>
                      )}
                      {pp.status === 'error' && (
                        <div style={{ fontSize: '11px', color: 'var(--error)' }}>
                          Error al cargar ·{' '}
                          <button
                            type="button"
                            onClick={() => {
                              setPendingProducts((prev) => prev.filter((p) => p.tempId !== pp.tempId));
                              onAddProduct?.(pp.name);
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontWeight: 700, padding: 0 }}
                          >
                            Reintentar
                          </button>
                        </div>
                      )}
                      {pp.status === 'done' && (
                        <div style={{ fontSize: '11px', color: 'var(--success, #16a34a)' }}>✓ Cargado</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add-product input */}
            <div style={{ display: 'flex', gap: '6px', paddingTop: '4px', borderTop: '1px solid var(--border)', marginTop: '4px' }}>
              <input
                type="text"
                value={newProductInput}
                onChange={(e) => setNewProductInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newProductInput.trim()) handleAddProduct();
                }}
                placeholder="Agregar producto..."
                style={{
                  flex: 1, padding: '8px 10px', fontSize: '12px',
                  borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                  background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleAddProduct}
                disabled={!newProductInput.trim()}
                style={{
                  padding: '8px 12px', borderRadius: 'var(--radius-md)', border: 'none',
                  background: 'var(--accent)', color: '#fff', fontSize: '12px', fontWeight: 700,
                  cursor: newProductInput.trim() ? 'pointer' : 'not-allowed',
                  opacity: newProductInput.trim() ? 1 : 0.5,
                }}
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Toggle button (always visible) ── */}
      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        style={{
          position: 'absolute',
          top: '50%', transform: 'translateY(-50%)',
          left: panelOpen ? '300px' : '0px',
          zIndex: 1001,
          width: '24px', height: '48px',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderLeft: panelOpen ? 'none' : '1px solid var(--border)',
          borderRadius: panelOpen ? '0 var(--radius-sm) var(--radius-sm) 0' : 'var(--radius-sm)',
          cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'left 0.2s ease',
        }}
        aria-label={panelOpen ? 'Ocultar panel' : 'Mostrar panel'}
      >
        {panelOpen ? '◀' : '▶'}
      </button>
    </div>
  );
}
