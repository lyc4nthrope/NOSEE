/**
 * OrdersPanel.jsx
 *
 * Panel de administración de pedidos y pagos.
 * Muestra funnel de estados, tabla de pedidos y resumen de pagos.
 *
 * UBICACIÓN: src/features/dashboard/admin/components/OrdersPanel.jsx
 */
import { useState, useEffect } from 'react';
import { getAdminOrders, getAdminPayments } from '@/services/api/adminOrders.api';
import { useLanguage } from '@/contexts/LanguageContext';
import { s, ACCENT, MUTED, TEXT, BORDER } from '../adminStyles';

const ORDER_STATUS_FLOW = [
  'pendiente_pago',
  'pendiente_repartidor',
  'aceptado',
  'pendiente_compromiso',
  'comprando',
  'en_camino',
  'llegando',
  'comprobante_subido',
  'entregado',
];

const TERMINAL_STATUSES = ['cancelado', 'cancelado_no_pago', 'entregado', 'usuario_se_encarga'];

function FunnelBar({ label, count, pct, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <span style={{ width: 140, fontSize: 12, color: MUTED, textAlign: 'right' }}>{label}</span>
      <div style={{
        flex: 1, height: 20, background: 'var(--bg-elevated)',
        borderRadius: 4, overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          width: `${Math.max(pct, 2)}%`, height: '100%',
          background: color || ACCENT, borderRadius: 4,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{ width: 60, fontSize: 13, fontWeight: 700, color: TEXT }}>{count}</span>
    </div>
  );
}

export default function OrdersPanel() {
  const { t } = useLanguage();
  const td = t.adminDashboard;

  const STATUS_LABELS = td.ordersPanel.statusLabels;

  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      const [ordersResult, paymentsResult] = await Promise.all([
        getAdminOrders({ page, pageSize }),
        getAdminPayments(),
      ]);

      if (!isMounted) return;

      if (!ordersResult.success) {
        setError(ordersResult.error);
      } else {
        setOrders(ordersResult.data || []);
      }

      if (!paymentsResult.success) {
        console.error('[OrdersPanel] Error loading payments:', paymentsResult.error);
      } else {
        setPayments(paymentsResult.data || []);
      }

      setIsLoading(false);
    }

    load();
    return () => { isMounted = false; };
  }, [page]);

  // Calcular funnel
  const statusCounts = {};
  for (const s of [...ORDER_STATUS_FLOW, ...TERMINAL_STATUSES]) {
    statusCounts[s] = 0;
  }
  for (const o of orders) {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
  }
  const maxCount = Math.max(...Object.values(statusCounts), 1);
  const activeOrders = orders.filter(o => !TERMINAL_STATUSES.includes(o.status)).length;

  // Filtro de búsqueda
  const searchLower = search.toLowerCase().trim();
  const filteredOrders = searchLower
    ? orders.filter(o =>
        (o.local_id || '').toLowerCase().includes(searchLower) ||
        (o.id || '').toString().includes(searchLower)
      )
    : orders;

  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: 32, color: MUTED }}>{td.ordersPanel.loading}</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: 32, color: 'var(--error)' }}>{error}</div>;
  }

  return (
    <>
      {/* Resumen numérico */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div style={{ ...s.statCard, flex: '1 1 140px', padding: '14px 18px' }}>
          <div style={s.statValue}>{orders.length}</div>
          <div style={s.statLabel}>{td.ordersPanel.totalOrders}</div>
        </div>
        <div style={{ ...s.statCard, flex: '1 1 140px', padding: '14px 18px' }}>
          <div style={{ ...s.statValue, color: 'var(--success)' }}>{activeOrders}</div>
          <div style={s.statLabel}>{td.ordersPanel.activeOrders}</div>
        </div>
        <div style={{ ...s.statCard, flex: '1 1 140px', padding: '14px 18px' }}>
          <div style={s.statValue}>
            {orders
              .filter(o => o.status === 'entregado')
              .reduce((sum, o) => sum + Number(o.total_estimated || 0), 0)
              .toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
            }
          </div>
          <div style={s.statLabel}>{td.ordersPanel.revenueDelivered}</div>
        </div>
        <div style={{ ...s.statCard, flex: '1 1 140px', padding: '14px 18px' }}>
          <div style={s.statValue}>{payments.length}</div>
          <div style={s.statLabel}>{td.ordersPanel.paymentsRegistered}</div>
        </div>
      </div>

      {/* Funnel visual */}
      <div style={{ ...s.section, marginTop: 0 }}>
        <div style={s.sectionHead}>
          <span style={s.sectionTitle}>{td.ordersPanel.orderFlow}</span>
        </div>
        <div style={{ ...s.configCard, padding: '16px 20px' }}>
          {ORDER_STATUS_FLOW.map((status, idx) => (
            <FunnelBar
              key={status}
              label={STATUS_LABELS[status] || status}
              count={statusCounts[status] || 0}
              pct={((statusCounts[status] || 0) / maxCount) * 100}
              color={`hsl(${210 - idx * 12}, 70%, ${55 - idx * 3}%)`}
            />
          ))}
          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 8, paddingTop: 8 }}>
            {TERMINAL_STATUSES.map(status => (
              <FunnelBar
                key={status}
                label={STATUS_LABELS[status] || status}
                count={statusCounts[status] || 0}
                pct={((statusCounts[status] || 0) / maxCount) * 100}
                color={status === 'entregado' ? 'var(--success)' : 'var(--error)'}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Tabla de pedidos */}
      <div style={{ ...s.section, marginTop: 24 }}>
        <div style={s.sectionHead}>
          <span style={s.sectionTitle}>{td.ordersPanel.recentOrders}</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={td.ordersPanel.searchPlaceholder}
            style={{ ...s.filterSelect, width: 220, fontFamily: 'inherit' }}
          />
        </div>

        {filteredOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: MUTED }}>
            {search ? td.ordersPanel.noSearchResults : td.ordersPanel.emptyOrders}
          </div>
        ) : (
          <div style={{ ...s.configCard, overflowX: 'auto', padding: 0 }}>
            <div style={{ minWidth: 680 }}>
              <div style={{ ...s.tableHead, gridTemplateColumns: '100px 1fr 100px 80px 100px', padding: '10px 16px' }}>
                <div style={s.th}>{td.ordersPanel.colId}</div>
                <div style={s.th}>{td.ordersPanel.colStatus}</div>
                <div style={s.th}>{td.ordersPanel.colTotal}</div>
                <div style={s.th}>{td.ordersPanel.colStrategy}</div>
                <div style={s.th}>{td.ordersPanel.colCreated}</div>
              </div>
              {filteredOrders.map((o, idx) => (
                <div key={o.id} style={{
                  ...s.tableRow, gridTemplateColumns: '100px 1fr 100px 80px 100px',
                  padding: '10px 16px', fontSize: 13,
                  background: idx % 2 === 0 ? 'transparent' : 'var(--bg-elevated)',
                }}>
                  <div style={{ ...s.td, fontSize: 12, color: MUTED }}>
                    {o.local_id || `#${o.id}`}
                  </div>
                  <div style={s.td}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                      background: o.status === 'entregado' ? 'var(--success-soft)' :
                                  o.status === 'cancelado' || o.status === 'cancelado_no_pago' ? 'var(--error-soft)' :
                                  'var(--bg-elevated)',
                      color: o.status === 'entregado' ? 'var(--success)' :
                             o.status === 'cancelado' || o.status === 'cancelado_no_pago' ? 'var(--error)' : MUTED,
                    }}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                  </div>
                  <div style={{ ...s.td, fontWeight: 600 }}>
                    {Number(o.total_estimated || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ ...s.td, fontSize: 11, color: MUTED }}>{o.strategy || '—'}</div>
                  <div style={{ ...s.td, fontSize: 11, color: MUTED }}>
                    {o.created_at ? new Date(o.created_at).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' }) : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, gap: 12 }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              padding: '6px 14px', borderRadius: 6, border: `1px solid var(--border)`,
              background: page === 0 ? 'var(--bg-elevated)' : 'transparent',
              color: page === 0 ? 'var(--muted)' : 'var(--text)', cursor: page === 0 ? 'default' : 'pointer',
              fontSize: 13,
            }}
          >
            {td.ordersPanel.prevPage}
          </button>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{td.ordersPanel.pageLabel(page + 1)}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={orders.length < pageSize}
            style={{
              padding: '6px 14px', borderRadius: 6, border: `1px solid var(--border)`,
              background: orders.length < pageSize ? 'var(--bg-elevated)' : 'transparent',
              color: orders.length < pageSize ? 'var(--muted)' : 'var(--text)', cursor: orders.length < pageSize ? 'default' : 'pointer',
              fontSize: 13,
            }}
          >
            {td.ordersPanel.nextPage}
          </button>
        </div>
      </div>
    </>
  );
}
