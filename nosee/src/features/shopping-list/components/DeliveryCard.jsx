import { useState, useEffect } from 'react';
import { calculateDeliveryFee } from '../utils/shoppingListUtils';
import { PaymentView } from './PaymentView';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getDealerBankAccounts } from '@/services/api/bankAccounts.api';
import { useDeliveryTimer } from '@/features/orders/hooks/useDeliveryTimer';
import { confirmCompromisoPago, requestDealerChange } from '@/services/api/orders.api';
import { CardPayment } from '@mercadopago/sdk-react';
import { supabase } from '@/services/supabase.client';

const STATUS_CONFIGS = {
  pendiente_compromiso: {
    icon: '🤝', bg: 'var(--warning-soft, #fef9c3)', border: 'var(--warning, #ca8a04)',
    color: '#92400e',
    title: 'Repartidor asignado — pagá el fondo de compromiso',
    desc: 'Pagá el fondo de compromiso para que el repartidor salga a comprar. El domicilio y los productos los pagás al momento de la entrega.',
    showCompromisoPago: true,
    step: 1,
  },
  searching: {
    icon: '🛵', bg: 'var(--warning-soft, #fef9c3)', border: 'var(--warning, #ca8a04)',
    color: '#92400e',
    title: 'Esperando que un repartidor acepte tu pedido',
    desc: 'Tu pedido ya es visible para todos los repartidores disponibles. Cuando alguien lo acepte, te notificamos para que hagás el pago de compromiso.',
    showCancel: true, cancelFree: true,
    step: 1,
  },
  found: {
    icon: '✓', bg: 'var(--bg-elevated)', border: 'var(--accent)',
    color: 'var(--accent)',
    title: 'Repartidor asignado',
    desc: 'Sigue su ubicación en tiempo real en el mapa →',
    showCancel: true, cancelFree: false,
    step: 1,
  },
  comprando: {
    icon: '🛒', bg: 'var(--bg-elevated)', border: 'var(--accent)',
    color: 'var(--accent)',
    title: 'Comprando tus productos',
    desc: 'El repartidor está comprando en las tiendas indicadas.',
    showCancel: false, showPin: true,
    step: 1,
  },
  en_camino: {
    icon: '🛵', bg: 'var(--success-soft, #dcfce7)', border: 'var(--success, #16a34a)',
    color: 'var(--success, #16a34a)',
    title: 'En camino a tu ubicación',
    desc: 'Sigue su posición en tiempo real en el mapa →',
    showCancel: false, showFee: true, showPin: true,
    step: 2,
  },
  llegando: {
    icon: '🔔', bg: 'var(--accent-soft)', border: 'var(--accent)',
    color: 'var(--accent)',
    title: '¡El repartidor llegó!',
    desc: 'Mostrá el PIN al repartidor y realizá el pago.',
    showCancel: false, showPayment: true, showPin: true,
    step: 2,
  },
  comprobante_subido: {
    icon: '⏳', bg: 'var(--bg-elevated)', border: 'var(--success, #16a34a)',
    color: 'var(--success, #16a34a)',
    title: 'Comprobante enviado',
    desc: 'El repartidor está verificando tu pago.',
    showCancel: false, showPin: true,
    step: 2,
  },
  entregado: {
    icon: '✅', bg: 'var(--success-soft, #dcfce7)', border: 'var(--success, #16a34a)',
    color: 'var(--success, #16a34a)',
    title: '¡Pedido entregado!',
    desc: 'Pago confirmado. Gracias por usar NØSEE.',
    showCancel: false,
    step: 3,
  },
  cancelled: {
    icon: '✗', bg: 'var(--error-soft, #fee2e2)', border: 'var(--error, #dc2626)',
    color: 'var(--error, #dc2626)',
    title: 'Envío cancelado',
    desc: null,
    showCancel: false,
    step: 0,
  },
  cancelado_no_pago: {
    icon: '⚠️', bg: 'var(--error-soft, #fee2e2)', border: 'var(--error, #dc2626)',
    color: 'var(--error, #dc2626)',
    title: 'Pedido reportado por no pago',
    desc: 'El repartidor reportó que no recibió el pago al momento de la entrega.',
    showCancel: false,
    step: 0,
  },
  auto_gestionado: {
    icon: '🙋', bg: 'var(--bg-elevated)', border: 'var(--border)',
    color: 'var(--text-muted)',
    title: 'Te encargás vos',
    desc: 'Decidiste gestionar este pedido por tu cuenta.',
    showCancel: false,
    step: 0,
  },
};

const STEPS = [
  { label: 'Preparando', icon: '🛒', step: 1 },
  { label: 'En camino', icon: '🛵', step: 2 },
  { label: 'Entregado', icon: '✅', step: 3 },
];

export function DeliveryCard({ order, onCancel, onPaymentSubmitted }) {
  const { deliveryStatus, cancellationCharged, dealerId, deliveryFee: storedFee, result, userCoords, deliveryPin, llegandoAt, compromisoAmount, dealerCancelInfo, dealerName, dealerPhone } = order;
  const displayFee = storedFee ?? calculateDeliveryFee(result?.stores, userCoords);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMode, setPaymentMode] = useState(null);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loadingBank, setLoadingBank] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [mpError, setMpError]           = useState(null);
  const [mpCustomerId, setMpCustomerId] = useState(null);
  const [mpCustomerReady, setMpCustomerReady] = useState(false);
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterNote, setCounterNote]           = useState('');
  const [counterSubmitting, setCounterSubmitting] = useState(false);
  const [counterDone, setCounterDone]             = useState(false);
  const [showReportModal,   setShowReportModal]   = useState(false);
  const [reportReason,      setReportReason]      = useState('');
  const [reportNote,        setReportNote]        = useState('');
  const [reportSubmitting,  setReportSubmitting]  = useState(false);
  const [reportDone,        setReportDone]        = useState(false);
  const [reportSubmitted,   setReportSubmitted]   = useState(false);
  const [showCancelModal,   setShowCancelModal]   = useState(false);
  const [changingDealer,    setChangingDealer]    = useState(false);
  const userId = useAuthStore((s) => s.user?.id);

  // Timer de 10 min para el Caso D (cliente ausente) — solo activo en estado 'llegando'
  const timerStart = deliveryStatus === 'llegando' ? (llegandoAt ?? null) : null;
  const { formattedTime, isExpired } = useDeliveryTimer(timerStart);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!['pendiente_compromiso', 'llegando'].includes(deliveryStatus) || !userId) return;
    setMpCustomerReady(false);
    supabase
      .from('users')
      .select('mp_customer_id')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data?.mp_customer_id) setMpCustomerId(data.mp_customer_id);
        setMpCustomerReady(true);
      });
  }, [deliveryStatus, userId]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (deliveryStatus !== 'llegando' || !dealerId) return;
    setLoadingBank(true);
    getDealerBankAccounts(dealerId).then(({ data }) => {
      setBankAccounts(data ?? []);
      setLoadingBank(false);
    });
  }, [deliveryStatus, dealerId]);

  // Verifica si el usuario ya reportó este pedido (persiste entre recargas)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!userId || !order.supabaseId) return;
    supabase
      .from('reports')
      .select('id')
      .eq('reported_type', 'dealer_issue')
      .eq('reported_id', String(order.supabaseId))
      .eq('reporter_user_id', userId)
      .maybeSingle()
      .then(({ data }) => { if (data) setReportDone(true); });
  }, [userId, order.supabaseId]);

  if (!deliveryStatus) return null;

  const cfg = STATUS_CONFIGS[deliveryStatus];
  if (!cfg) return null;

  // Pago final con pasarela (estado llegando) — usa la tarjeta guardada del pago de servicio
  const handleFinalMPSubmit = async (formData) => {
    if (!order.supabaseId) return;
    setConfirmingPayment(true);
    setMpError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('process-mp-payment', {
        body: {
          orderId:              order.supabaseId,
          token:                formData.token,
          paymentMethodId:      formData.payment_method_id,
          issuerId:             formData.issuer_id,
          installments:         formData.installments,
          email:                formData.payer?.email,
          identificationType:   formData.payer?.identification?.type,
          identificationNumber: formData.payer?.identification?.number,
        },
      });
      if (fnErr || !data?.success) {
        setMpError(`Pago rechazado: ${data?.detail ?? data?.error ?? 'intentá de nuevo'}`);
      } else {
        onPaymentSubmitted?.({ receiptUrl: null, method: 'pasarela' });
      }
    } catch (err) {
      setMpError('Error inesperado. Verificá tu conexión e intentá de nuevo.');
      console.error('[DeliveryCard] final MP payment error:', err);
    } finally {
      setConfirmingPayment(false);
    }
  };

  // Pago del fondo de compromiso con MercadoPago (estado pendiente_compromiso)
  const handleCompromisoSubmit = async (formData) => {
    if (!order.supabaseId) return;
    setConfirmingPayment(true);
    setMpError(null);
    try {
      const { data, error: fnErr } = await confirmCompromisoPago(order.supabaseId, {
        token:                formData.token,
        paymentMethodId:      formData.payment_method_id,
        issuerId:             formData.issuer_id,
        installments:         formData.installments,
        email:                formData.payer?.email,
        identificationType:   formData.payer?.identification?.type,
        identificationNumber: formData.payer?.identification?.number,
      });
      if (fnErr || !data?.success) {
        const detail = data?.detail ?? data?.error ?? 'intentá de nuevo';
        const msg = data?.status === 'mp_api_error'
          ? `Error de MercadoPago: ${detail}. Volvé a ingresar los datos de la tarjeta.`
          : `Pago rechazado: ${detail}`;
        setMpError(msg);
      } else if (data?.customerId) {
        setMpCustomerId(data.customerId);
      }
      // Realtime en PedidosTab actualiza deliveryStatus a 'comprando' automáticamente
    } catch (err) {
      setMpError('Error inesperado. Verificá tu conexión e intentá de nuevo.');
      console.error('[DeliveryCard] compromiso payment error:', err);
    } finally {
      setConfirmingPayment(false);
    }
  };

  const desc = deliveryStatus === 'cancelled'
    ? (cancellationCharged
        ? 'Se cobrará el costo del domicilio — el pedido no fue comprado.'
        : 'Cancelado sin costo adicional.')
    : cfg.desc;

  const handlePaymentSubmitted = (result) => {
    setShowPayment(false);
    onPaymentSubmitted?.(result);
  };


  const currentStep = cfg.step;

  // Reporta un problema con el repartidor (nunca llegó, actitud, etc.)
  const handleDealerReport = async () => {
    if (!reportReason) return;
    setReportSubmitting(true);
    let gpsEvidence = null;
    try {
      await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => { gpsEvidence = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }; resolve(); },
          () => resolve(),
          { timeout: 5000, maximumAge: 30_000 }
        );
      });
    } catch { /* noop */ }

    await supabase.from('reports').insert({
      reported_type:    'dealer_issue',
      reported_id:      String(order.supabaseId),
      reporter_user_id: userId,
      reported_user_id: dealerId,
      reason:           reportReason,
      description:      JSON.stringify({ note: reportNote || null, gps_client: gpsEvidence, timestamp: new Date().toISOString() }),
      status: 'pending',
    });

    setReportSubmitting(false);
    setReportDone(true);
    setReportSubmitted(true);
  };

  // Solicita cambiar de repartidor (solo en pendiente_compromiso)
  const handleChangeDealer = async () => {
    setChangingDealer(true);
    const { error } = await requestDealerChange(order.supabaseId);
    setChangingDealer(false);
    if (!error) {
      setShowCancelModal(false);
      onCancel?.();
    }
  };

  // Cambiar de repartidor desde el flujo post-reporte
  const handleChangeDealerFromReport = async () => {
    setChangingDealer(true);
    const { error } = await requestDealerChange(order.supabaseId);
    setChangingDealer(false);
    if (!error) {
      setShowReportModal(false);
      setReportSubmitted(false);
      setReportNote('');
      setReportReason('');
      onCancel?.();
    }
  };

  // Captura GPS del cliente y registra el contrareporte en reports
  const handleCounterReport = async () => {
    setCounterSubmitting(true);
    let gpsEvidence = null;
    try {
      await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            gpsEvidence = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
            resolve();
          },
          () => resolve(),
          { timeout: 5000, maximumAge: 30_000 }
        );
      });
    } catch { /* noop */ }

    await supabase.from('reports').insert({
      reported_type:    'counter_no_payment',
      reported_id:      String(order.supabaseId),
      reporter_user_id: userId,
      reported_user_id: null,
      reason:           'counter_dispute',
      description:      JSON.stringify({
        note:       counterNote || null,
        gps_client: gpsEvidence,
        timestamp:  new Date().toISOString(),
      }),
      status: 'pending',
    });

    setCounterSubmitting(false);
    setCounterDone(true);
    setShowCounterModal(false);
    setCounterNote('');
  };

  // Cancelled / auto_gestionado state — simple terminal banner
  if (deliveryStatus === 'cancelled' || deliveryStatus === 'auto_gestionado') {
    return (
      <div style={{
        padding: '14px 16px', borderRadius: 'var(--radius-md)',
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <span style={{ fontSize: '20px' }}>{cfg.icon}</span>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: cfg.color }}>{cfg.title}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{desc}</div>
        </div>
      </div>
    );
  }

  // cancelado_no_pago — banner con opción de contrareporte
  if (deliveryStatus === 'cancelado_no_pago') {
    return (
      <>
        <div style={{
          padding: '14px 16px', borderRadius: 'var(--radius-md)',
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <span style={{ fontSize: '20px', flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: cfg.color }}>{cfg.title}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.5 }}>{cfg.desc}</div>
            </div>
          </div>

          {counterDone ? (
            <div style={{
              fontSize: '12px', fontWeight: 700, color: 'var(--success, #16a34a)',
              padding: '10px 12px',
              background: 'var(--success-soft, #dcfce7)',
              border: '1px solid var(--success, #16a34a)',
              borderRadius: '8px',
            }}>
              ✓ Contrareporte enviado — el equipo de NØSEE revisará ambas partes.
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCounterModal(true)}
              style={{
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${cfg.border}`,
                background: 'transparent', color: cfg.color,
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              📋 Hacer contrareporte
            </button>
          )}
        </div>

        {showCounterModal && (
          <div
            style={{
              position: 'fixed', inset: 0,
              background: 'var(--overlay, rgba(0,0,0,0.55))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, padding: '16px',
            }}
            onClick={() => { setShowCounterModal(false); setCounterNote(''); }}
          >
            <div
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
                width: 'min(440px, 100%)',
                display: 'flex', flexDirection: 'column', gap: 16,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Título */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  📋 Contrareporte
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Se registrará tu <strong>ubicación actual</strong> como evidencia.
                  El equipo de NØSEE revisará el reporte del repartidor y el tuyo.
                </p>
              </div>

              {/* Nota */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  ¿Qué pasó? (opcional)
                </label>
                <textarea
                  value={counterNote}
                  onChange={(e) => setCounterNote(e.target.value)}
                  placeholder="Ej: sí realicé el pago, tengo comprobante de transferencia..."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 12px', fontSize: 13,
                    border: '1px solid var(--border)', borderRadius: 8,
                    background: 'var(--bg-base)', color: 'var(--text-primary)',
                    resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                    boxSizing: 'border-box', lineHeight: 1.5,
                  }}
                />
              </div>

              {/* Acciones */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setShowCounterModal(false); setCounterNote(''); }}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'transparent',
                    color: 'var(--text-muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCounterReport}
                  disabled={counterSubmitting}
                  style={{
                    flex: 2, padding: '10px 14px', borderRadius: 8, border: 'none',
                    background: 'var(--accent)', color: '#fff',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    ...(counterSubmitting ? { opacity: 0.7 } : {}),
                  }}
                >
                  {counterSubmitting ? 'Enviando...' : '✓ Enviar contrareporte'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* ── Progress tracker ── */}
      <div style={{
        padding: '16px',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        {/* 3-step indicator */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
          {STEPS.map((s, i) => {
            const isActive = currentStep >= s.step;
            const isLast = i === STEPS.length - 1;
            return (
              <div key={s.step} style={{ display: 'flex', alignItems: 'flex-start', flex: isLast ? 0 : 1 }}>
                {/* Step circle + label */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: isActive ? 'var(--accent)' : 'var(--bg-elevated)',
                    border: `2px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px',
                    boxShadow: isActive ? '0 0 0 3px var(--accent-soft)' : 'none',
                    transition: 'all 0.2s',
                  }}>
                    {isActive ? s.icon : <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-muted)' }}>{i + 1}</span>}
                  </div>
                  <span style={{
                    fontSize: '10px', fontWeight: isActive ? 700 : 500,
                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}>{s.label}</span>
                </div>
                {/* Connector line (not after last step) */}
                {!isLast && (
                  <div style={{
                    flex: 1, height: '2px', marginTop: '19px',
                    background: currentStep > s.step ? 'var(--accent)' : 'var(--border)',
                    transition: 'background 0.2s',
                  }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Current status text */}
        <div style={{
          padding: '10px 14px',
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          borderRadius: 'var(--radius-sm)',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: cfg.color }}>{cfg.title}</div>
          {desc && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{desc}</div>}
          {cfg.showFee && (
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success, #16a34a)', marginTop: '4px' }}>
              Costo domicilio: ${displayFee.toLocaleString('es-CO')} COP
            </div>
          )}
        </div>

        {/* Banner: repartidor canceló — visible mientras buscamos uno nuevo */}
        {deliveryStatus === 'searching' && dealerCancelInfo && (
          <div style={{
            padding: '10px 14px',
            background: 'var(--warning-soft, #fef9c3)',
            border: '1px solid var(--warning, #ca8a04)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#92400e' }}>
              {dealerCancelInfo.type === 'emergency' ? '🚨 El repartidor tuvo una emergencia' : '⚠️ El repartidor canceló por una causa menor'}
            </div>
            {dealerCancelInfo.reason && (
              <div style={{ fontSize: 11, color: '#92400e', lineHeight: 1.5 }}>
                "{dealerCancelInfo.reason}"
              </div>
            )}
            <div style={{ fontSize: 11, color: '#92400e' }}>
              Tu pedido quedó marcado como <strong>prioritario</strong> — lo verá el siguiente repartidor disponible primero.
            </div>
          </div>
        )}

        {/* Dealer info (when assigned) */}
        {dealerId && deliveryStatus !== 'searching' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'var(--accent-soft)', border: '2px solid var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', flexShrink: 0,
            }}>🛵</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {dealerName ?? 'Repartidor asignado'}
              </div>
              {dealerPhone ? (
                <a
                  href={`tel:${dealerPhone}`}
                  style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
                >
                  📞 {dealerPhone}
                </a>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Seguí su ubicación en el mapa</div>
              )}
            </div>
            {!reportDone && ['comprando', 'en_camino', 'llegando', 'comprobante_subido'].includes(deliveryStatus) && (
              <button
                type="button"
                onClick={() => setShowReportModal(true)}
                style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0,
                }}
              >
                ⚠️ Reportar
              </button>
            )}
            {reportDone && (
              <span style={{ fontSize: 11, color: 'var(--success, #16a34a)', fontWeight: 700 }}>✓ Reportado</span>
            )}
          </div>
        )}

        {/* PIN de verificación (visible al cliente cuando el repartidor llega) */}
        {cfg.showPin && deliveryPin && (
          <div style={{
            padding: '14px 16px',
            background: deliveryStatus === 'llegando' ? 'var(--bg-elevated)' : 'var(--bg-surface)',
            border: `2px solid ${deliveryStatus === 'llegando' ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)', textAlign: 'center',
          }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {deliveryStatus === 'llegando' ? '🔑 Tu PIN de entrega' : '🔑 Guardá este código'}
            </div>
            <div style={{ fontSize: '36px', fontWeight: 900, letterSpacing: '0.25em', color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
              {deliveryPin}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {deliveryStatus === 'llegando'
                ? 'Dictáselo al repartidor para confirmar la entrega'
                : 'Cuando el repartidor llegue, dictale este PIN para confirmar la entrega'}
            </div>
          </div>
        )}

        {/* Timer de espera (Caso D) */}
        {deliveryStatus === 'llegando' && timerStart && (
          <div style={{
            padding: '10px 14px',
            background: isExpired ? 'var(--error-soft, #fee2e2)' : 'var(--bg-elevated)',
            border: `1px solid ${isExpired ? 'var(--error, #dc2626)' : 'var(--border)'}`,
            borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '16px' }}>{isExpired ? '⚠️' : '⏱'}</span>
            <span style={{ fontSize: '12px', color: isExpired ? 'var(--error, #dc2626)' : 'var(--text-muted)', fontWeight: isExpired ? 700 : 500 }}>
              {isExpired
                ? 'El tiempo de espera venció. Si no recibís respuesta, el repartidor puede marcar que el cliente no pagó.'
                : `El repartidor tiene ${formattedTime} de espera`}
            </span>
          </div>
        )}

        {/* Action buttons */}
        {(cfg.showCancel || cfg.showPayment || cfg.showCompromisoPago) && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {cfg.showCancel && (
              <button
                type="button"
                onClick={cfg.cancelFree ? onCancel : () => setShowCancelModal(true)}
                style={{
                  flex: 1, padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${cfg.border}`,
                  background: 'transparent', color: cfg.color,
                  fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                }}
              >
                {cfg.cancelFree ? '✕ Cancelar envío' : '✕ Opciones de cancelación'}
              </button>
            )}
            {cfg.showCompromisoPago && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                <div style={{
                  padding: '12px 14px',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex', flexDirection: 'column', gap: '6px',
                }}>
                  <p style={{ margin: 0, fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    🤝 Un repartidor aceptó tu pedido
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Para que salga a comprar, necesitamos que hagás un <strong>pago de compromiso</strong>.
                    Este monto va a un <strong>fondo de respaldo para repartidores</strong> — protege al repartidor
                    si es víctima de una estafa, y le da confianza de que vas a recibir el pedido.
                  </p>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    💡 <strong>El costo de tus productos y el domicilio los pagás directamente al repartidor cuando entregue.</strong>
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px', borderTop: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pago de compromiso</span>
                    <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent)' }}>
                      ${(compromisoAmount ?? 0).toLocaleString('es-CO')} COP
                    </span>
                  </div>
                </div>
                {mpCustomerReady ? (
                  <CardPayment
                    initialization={{
                      amount: compromisoAmount ?? 0,
                    }}
                    onSubmit={handleCompromisoSubmit}
                    onError={(err) => setMpError(err.message)}
                    customization={{
                      paymentMethods: { minInstallments: 1, maxInstallments: 1 },
                    }}
                  />
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                    Cargando pasarela...
                  </div>
                )}
                {confirmingPayment && (
                  <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 700, textAlign: 'center' }}>
                    ⏳ Procesando pago...
                  </div>
                )}
                {mpError && (
                  <span style={{ fontSize: '11px', color: 'var(--error, #dc2626)', fontWeight: 600 }}>{mpError}</span>
                )}
              </div>
            )}
            {cfg.showPayment && (
              order.paymentMethod === 'efectivo' ? (
                <div style={{
                  flex: 1, padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  fontSize: '12px', color: 'var(--text-muted)',
                  textAlign: 'center', fontWeight: 600,
                }}>
                  💵 Pagá en efectivo al repartidor
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                    ¿Cómo realizás el pago?
                  </p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Por confianza = comprobante de transferencia */}
                    <button
                      type="button"
                      onClick={() => { setPaymentMode('confianza'); setShowPayment(true); }}
                      disabled={loadingBank}
                      style={{
                        flex: 1, padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: `2px solid ${paymentMode === 'confianza' ? 'var(--accent)' : 'var(--border)'}`,
                        background: paymentMode === 'confianza' ? 'var(--accent-soft)' : 'transparent',
                        color: paymentMode === 'confianza' ? 'var(--accent)' : 'var(--text-muted)',
                        fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                        opacity: loadingBank ? 0.6 : 1,
                      }}
                    >
                      📎 Por confianza
                    </button>
                    {/* Pasarela = CardPayment brick con tarjeta guardada */}
                    <button
                      type="button"
                      onClick={() => { setPaymentMode('pasarela'); setShowPayment(false); }}
                      style={{
                        flex: 1, padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: `2px solid ${paymentMode === 'pasarela' ? 'var(--accent)' : 'var(--border)'}`,
                        background: paymentMode === 'pasarela' ? 'var(--accent-soft)' : 'transparent',
                        color: paymentMode === 'pasarela' ? 'var(--accent)' : 'var(--text-muted)',
                        fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      💳 Pasarela
                    </button>
                  </div>

                  {/* Pasarela: CardPayment brick con tarjeta guardada del pago de servicio */}
                  {paymentMode === 'pasarela' && (
                    <>
                      {mpCustomerReady ? (
                        <CardPayment
                          initialization={{
                            amount: (result?.totalCost ?? 0) + displayFee,
                            ...(mpCustomerId ? { payer: { customerId: mpCustomerId } } : {}),
                          }}
                          onSubmit={handleFinalMPSubmit}
                          onError={(err) => setMpError(err.message)}
                          customization={{
                            paymentMethods: { minInstallments: 1, maxInstallments: 1 },
                          }}
                        />
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>
                          Cargando pasarela...
                        </div>
                      )}
                      {confirmingPayment && (
                        <div style={{ fontSize: '12px', color: 'var(--accent)', fontWeight: 700, textAlign: 'center' }}>
                          ⏳ Procesando pago...
                        </div>
                      )}
                      {mpError && (
                        <span style={{ fontSize: '11px', color: 'var(--error, #dc2626)', fontWeight: 600 }}>{mpError}</span>
                      )}
                    </>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Cambiar de repartidor (solo en pendiente_compromiso, antes de que empiece a comprar) */}
      {deliveryStatus === 'pendiente_compromiso' && (
        <button
          type="button"
          onClick={() => setShowCancelModal(true)}
          style={{
            padding: '8px 14px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 700,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--text-muted)', cursor: 'pointer', alignSelf: 'flex-start',
          }}
        >
          ↺ Cambiar repartidor / Cancelar pedido
        </button>
      )}

      {/* Payment view (expandible) */}
      {showPayment && deliveryStatus === 'llegando' && (
        <PaymentView
          order={order}
          userId={userId}
          bankAccounts={bankAccounts}
          onPaymentSubmitted={handlePaymentSubmitted}
        />
      )}

      {/* ── Modal: Reportar problema con el repartidor ── */}
      {showReportModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'var(--overlay, rgba(0,0,0,0.55))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
          onClick={() => { if (!reportSubmitted) { setShowReportModal(false); setReportReason(''); setReportNote(''); } }}
        >
          <div
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px', width: 'min(440px, 100%)', display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            {!reportSubmitted ? (
              <>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>⚠️ Reportar problema</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    El equipo de NØSEE revisará tu reporte. Tu ubicación se registra como evidencia.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Motivo</label>
                  {['no_llega', 'no_contesta', 'actitud_grosera', 'problema_pedido', 'otro'].map((r) => (
                    <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input type="radio" name="reportReason" value={r} checked={reportReason === r} onChange={() => setReportReason(r)} />
                      {r === 'no_llega' && 'El repartidor no llega'}
                      {r === 'no_contesta' && 'El repartidor no contesta'}
                      {r === 'actitud_grosera' && 'Actitud grosera o inapropiada'}
                      {r === 'problema_pedido' && 'Problema con el pedido'}
                      {r === 'otro' && 'Otro motivo'}
                    </label>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Descripción (opcional)</label>
                  <textarea
                    value={reportNote}
                    onChange={(e) => setReportNote(e.target.value)}
                    placeholder="Detallá lo que pasó..."
                    rows={3}
                    style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-base)', color: 'var(--text-primary)', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.5 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => { setShowReportModal(false); setReportReason(''); setReportNote(''); }}
                    style={{ flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleDealerReport}
                    disabled={!reportReason || reportSubmitting}
                    style={{ flex: 2, padding: '10px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!reportReason || reportSubmitting) ? 0.5 : 1 }}
                  >
                    {reportSubmitting ? 'Enviando...' : '✓ Enviar reporte'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>Reporte enviado</h2>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    El equipo de NØSEE revisará el problema. ¿Qué querés hacer con tu pedido?
                  </p>
                </div>

                <button
                  onClick={handleChangeDealerFromReport}
                  disabled={changingDealer}
                  style={{ padding: '14px 18px', borderRadius: 8, border: '2px solid var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 14, fontWeight: 800, cursor: 'pointer', textAlign: 'left', opacity: changingDealer ? 0.6 : 1 }}
                >
                  <div>↺ Cambiar de repartidor</div>
                  <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2, color: 'var(--text-muted)' }}>
                    Tu pedido vuelve al pool — otro repartidor lo aceptará
                  </div>
                </button>

                <button
                  onClick={() => { setShowReportModal(false); setReportSubmitted(false); setReportNote(''); setReportReason(''); onCancel?.(); }}
                  style={{ padding: '14px 18px', borderRadius: 8, border: '1px solid var(--error, #dc2626)', background: 'transparent', color: 'var(--error, #dc2626)', fontSize: 14, fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}
                >
                  <div>✕ Cancelar pedido</div>
                  <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2, color: 'var(--text-muted)' }}>
                    Se cobrará el costo del domicilio
                  </div>
                </button>

                <button
                  onClick={() => { setShowReportModal(false); setReportSubmitted(false); setReportNote(''); setReportReason(''); }}
                  style={{ padding: '12px 14px', borderRadius: 8, border: '2px solid var(--border-soft, #6b7280)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Mantener repartidor actual
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: Cancelar pedido / Cambiar de repartidor ── */}
      {showCancelModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'var(--overlay, rgba(0,0,0,0.55))', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
          onClick={() => setShowCancelModal(false)}
        >
          <div
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '24px', width: 'min(400px, 100%)', display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>¿Qué querés hacer?</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                El repartidor aún no empezó a comprar. Podés cambiar de repartidor o cancelar el pedido.
              </p>
            </div>

            <button
              onClick={handleChangeDealer}
              disabled={changingDealer}
              style={{ padding: '14px 18px', borderRadius: 8, border: '2px solid var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 14, fontWeight: 800, cursor: 'pointer', textAlign: 'left', opacity: changingDealer ? 0.6 : 1 }}
            >
              <div>↺ Cambiar de repartidor</div>
              <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2, color: 'var(--text-muted)' }}>
                Tu pedido vuelve al pool — otro repartidor lo aceptará
              </div>
            </button>

            <button
              onClick={() => { setShowCancelModal(false); onCancel?.(); }}
              style={{ padding: '14px 18px', borderRadius: 8, border: '1px solid var(--error, #dc2626)', background: 'transparent', color: 'var(--error, #dc2626)', fontSize: 14, fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}
            >
              <div>✕ Cancelar pedido</div>
              <div style={{ fontSize: 11, fontWeight: 500, marginTop: 2, color: 'var(--text-muted)' }}>
                Se cobrará el costo del domicilio
              </div>
            </button>

            <button
              onClick={() => setShowCancelModal(false)}
              style={{ padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              Volver
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
