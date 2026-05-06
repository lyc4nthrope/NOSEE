/**
 * StoreDetailModal.jsx
 * Modal de detalle de tienda: muestra ubicación en mapa y publicaciones recientes.
 * Desktop: modal centrado con dot-grid header y publicaciones en grid.
 * Mobile:  bottom sheet con drag handle y layout de lista.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { getStorePublications, getStoreEvidences, updateStore } from '@/services/api/stores.api';
import { optimizeCloudinaryUrl } from '@/services/cloudinary';
import StoreMapPicker from '@/features/stores/components/StoreMapPicker';
import { useAuthStore, selectAuthUser } from '@/features/auth/store/authStore';
import { ReportModal } from '@/components/ReportModal';
import { useIsMobile } from '@/hooks/useIsMobile';

/* ── Keyframes injected once ─────────────────────────── */
if (typeof document !== 'undefined' && !document.getElementById('sdm-keyframes')) {
  const el = document.createElement('style');
  el.id = 'sdm-keyframes';
  el.textContent = `
    @keyframes sdm-in {
      from { opacity: 0; transform: translateY(20px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes sdm-sheet-in {
      from { transform: translateY(100%); }
      to   { transform: translateY(0); }
    }
    @keyframes sdm-pulse-dot {
      0%, 100% { opacity: 0.4; transform: scale(1); }
      50%       { opacity: 1;   transform: scale(1.4); }
    }
    @keyframes sdm-shimmer {
      0%   { background-position: -200% 0; }
      100% { background-position:  200% 0; }
    }
  `;
  document.head.appendChild(el);
}

/* ── Icon micro-components ───────────────────────────── */
function PinIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  );
}

function GlobeIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
}

function CloseIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function FlagIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
      <line x1="4" y1="22" x2="4" y2="15"/>
    </svg>
  );
}

/* ── Shared base style for icon buttons ──────────────── */
const iconBtnBase = {
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--text-muted)',
  transition: 'border-color 0.15s, color 0.15s, background 0.15s',
  flexShrink: 0,
};

/* ── HeaderActions ───────────────────────────────────── */
function HeaderActions({ onReport, onClose, closeLabel, btnSize = 30 }) {
  const [reportHov, setReportHov] = useState(false);
  const [closeHov, setCloseHov] = useState(false);
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      <button
        type="button"
        aria-label="Reportar tienda"
        onClick={onReport}
        onMouseEnter={() => setReportHov(true)}
        onMouseLeave={() => setReportHov(false)}
        style={{
          ...iconBtnBase,
          width: btnSize,
          height: btnSize,
          ...(reportHov ? { borderColor: 'var(--error)', color: 'var(--error)', background: 'rgba(248,113,113,0.08)' } : {}),
        }}
      >
        <FlagIcon />
      </button>
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        onMouseEnter={() => setCloseHov(true)}
        onMouseLeave={() => setCloseHov(false)}
        style={{
          ...iconBtnBase,
          width: btnSize,
          height: btnSize,
          ...(closeHov ? { borderColor: 'var(--border-soft)', color: 'var(--text-primary)', background: 'var(--bg-elevated)' } : {}),
        }}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

/* ── StoreInfoBar ────────────────────────────────────── */
function StoreInfoBar({ address, isPhysical, websiteUrl, visitWebsiteLabel, style }) {
  if (!address && (isPhysical || !websiteUrl)) return null;
  return (
    <div style={style}>
      {address && (
        <div style={infoItemStyle}>
          <PinIcon />
          <span>{address}</span>
        </div>
      )}
      {!isPhysical && websiteUrl && (
        <a
          href={websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...infoItemStyle, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
        >
          <GlobeIcon />
          <span>{visitWebsiteLabel} ↗</span>
        </a>
      )}
    </div>
  );
}

const infoItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '5px',
  fontSize: '11px',
  color: 'var(--text-muted)',
};

/* ── PublicationMini ─────────────────────────────────── */
function PublicationMini({ pub, onNavigate, isMobile }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      style={{ ...pm.card, ...(hov ? pm.cardHov : {}), ...(isMobile ? pm.cardMobile : {}) }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onNavigate(pub.id)}
      title={pub.product?.name || ''}
    >
      {pub.photo_url ? (
        <img
          src={optimizeCloudinaryUrl(pub.photo_url, { width: 180 })}
          alt={pub.product?.name || ''}
          style={isMobile ? pm.imgMobile : pm.img}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div style={isMobile ? { ...pm.imgEmpty, ...pm.imgMobile } : { ...pm.imgEmpty, ...pm.img }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
      )}
      <div style={pm.body}>
        <span style={pm.name}>{pub.product?.name || '—'}</span>
        <span style={pm.price}>${pub.price?.toLocaleString('es-CO')}</span>
      </div>
      <div style={{ ...pm.arrow, ...(hov ? pm.arrowHov : {}) }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      </div>
    </button>
  );
}

const pm = {
  card: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', width: '100%', textAlign: 'left', cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s' },
  cardHov: { background: 'var(--bg-elevated)', borderColor: 'var(--accent)' },
  cardMobile: { padding: '12px 14px', gap: '14px' },
  img: { width: '44px', height: '44px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', display: 'block', flexShrink: 0 },
  imgMobile: { width: '52px', height: '52px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', display: 'block', flexShrink: 0 },
  imgEmpty: { background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 },
  body: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' },
  name: { fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  price: { fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' },
  arrow: { flexShrink: 0, color: 'var(--border-soft)', transition: 'color 0.2s, transform 0.2s' },
  arrowHov: { color: 'var(--accent)', transform: 'translateX(2px)' },
};

/* ── Sub-components ──────────────────────────────────── */

function SectionLabel({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>
        {children}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  );
}

function EvidenceFrame({ ev, storeName, label, onExpand }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      aria-label={`${label}: ${storeName}`}
      style={{ padding: 0, border: `1px solid ${hov ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius-md)', overflow: 'hidden', cursor: 'pointer', background: 'none', flexShrink: 0, position: 'relative', transition: 'border-color 0.2s' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onExpand(ev.image_url)}
    >
      <img
        src={optimizeCloudinaryUrl(ev.image_url, { width: 400 })}
        alt={storeName}
        style={{ width: '120px', height: '88px', objectFit: 'cover', display: 'block', transition: 'transform 0.3s, filter 0.3s', ...(hov ? { transform: 'scale(1.05)', filter: 'brightness(0.7)' } : {}) }}
        loading="lazy"
        decoding="async"
      />
      {hov && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </div>
      )}
    </button>
  );
}

function MapsCtaButton({ store, isMobile }) {
  const [hov, setHov] = useState(false);
  return (
    <a
      href={`https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: isMobile ? '14px 16px' : '11px 16px', background: hov ? 'var(--accent)' : 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-md)', color: hov ? 'var(--bg-base)' : 'var(--accent)', textDecoration: 'none', fontSize: isMobile ? '14px' : '13px', fontWeight: 600, transition: 'background 0.2s, color 0.2s' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <PinIcon size={15} />
      <span>Cómo llegar · Google Maps</span>
      <span style={{ marginLeft: 'auto', opacity: 0.6 }}>↗</span>
    </a>
  );
}

function SaveButton({ onClick, disabled, label }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ padding: '8px 18px', background: hov && !disabled ? 'var(--accent)' : 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', color: hov && !disabled ? 'var(--bg-base)' : 'var(--accent)', fontSize: '12px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, transition: 'background 0.2s, color 0.2s', letterSpacing: '0.03em' }}
    >
      {label}
    </button>
  );
}

function ShimmerCard({ height = 64, delay = 0 }) {
  return (
    <div style={{
      height,
      borderRadius: 'var(--radius-md)',
      background: 'linear-gradient(90deg, var(--bg-elevated) 25%, var(--bg-hover) 50%, var(--bg-elevated) 75%)',
      backgroundSize: '200% 100%',
      animation: 'sdm-shimmer 1.4s ease-in-out infinite',
      animationDelay: `${delay}s`,
    }} />
  );
}

/* ── StoreDetailModal ────────────────────────────────── */
export default function StoreDetailModal({ store, onClose, onStoreUpdated }) {
  const { t } = useLanguage();
  const td = t.storesPage.storeDetail;
  const ts = t.storeDetailModal;
  const navigate = useNavigate();
  const currentUser = useAuthStore(selectAuthUser);
  const isMobile = useIsMobile(640);

  const canEdit =
    currentUser &&
    (
      currentUser.role === 'Admin' ||
      currentUser.role === 'Moderador' ||
      (store.created_by && currentUser.id === store.created_by)
    );

  const [publications, setPublications] = useState([]);
  const [loadingPubs, setLoadingPubs] = useState(true);
  const [evidences, setEvidences] = useState([]);
  const [expandedEvidence, setExpandedEvidence] = useState(null);
  const [evidenceError, setEvidenceError] = useState(null);
  const [localStore, setLocalStore] = useState(store);
  const [editAddress, setEditAddress] = useState(store.address || '');
  const [editLatitude, setEditLatitude] = useState(
    Number.isFinite(Number(store.latitude)) ? String(store.latitude) : ''
  );
  const [editLongitude, setEditLongitude] = useState(
    Number.isFinite(Number(store.longitude)) ? String(store.longitude) : ''
  );
  const [savingStore, setSavingStore] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [verTodosHov, setVerTodosHov] = useState(false);

  const isPhysical = localStore.type === 'physical';
  const accentColor = isPhysical ? 'var(--success)' : 'var(--info)';

  useEffect(() => {
    setLocalStore(store);
    setEditAddress(store.address || '');
    setEditLatitude(Number.isFinite(Number(store.latitude)) ? String(store.latitude) : '');
    setEditLongitude(Number.isFinite(Number(store.longitude)) ? String(store.longitude) : '');
    setSaveMessage('');
  }, [store]);

  useEffect(() => {
    let cancelled = false;
    setLoadingPubs(true);
    setEvidenceError(null);
    (async () => {
      try {
        const [pubsRes, evidRes] = await Promise.allSettled([
          getStorePublications(localStore.id, 6),
          isPhysical ? getStoreEvidences(localStore.id) : Promise.resolve({ success: true, data: [] }),
        ]);
        if (cancelled) return;
        const pubsValue = pubsRes.status === 'fulfilled' ? pubsRes.value : { success: false, data: [] };
        const evidValue = evidRes.status === 'fulfilled' ? evidRes.value : { success: false, data: [] };
        setPublications(pubsValue.success ? pubsValue.data : []);
        setEvidences(evidValue.success ? evidValue.data : []);
        if (!evidValue.success && isPhysical) setEvidenceError(evidValue.error || td.noEvidences);
      } finally {
        if (!cancelled) setLoadingPubs(false);
      }
    })();
    return () => { cancelled = true; };
  }, [localStore.id, isPhysical, td.noEvidences]);

  const handleSaveStore = async () => {
    if (!isPhysical) return;
    setSavingStore(true);
    setSaveMessage('');
    const parsedLat = Number(editLatitude);
    const parsedLon = Number(editLongitude);
    const payload = {
      address: editAddress,
      latitude: Number.isFinite(parsedLat) ? parsedLat : undefined,
      longitude: Number.isFinite(parsedLon) ? parsedLon : undefined,
    };
    const result = await updateStore(localStore.id, payload);
    setSavingStore(false);
    if (!result.success) { setSaveMessage(result.error || ts.errorUpdate); return; }
    const updatedStore = { ...localStore, ...result.data, address: result.data.address ?? localStore.address, latitude: result.data.latitude, longitude: result.data.longitude };
    setLocalStore((prev) => ({ ...prev, ...result.data, address: result.data.address ?? prev.address, latitude: result.data.latitude, longitude: result.data.longitude }));
    if (typeof onStoreUpdated === 'function') onStoreUpdated(updatedStore);
    if (typeof window !== 'undefined') {
      const detail = { storeId: updatedStore.id, updatedStore, updatedAt: Date.now() };
      window.dispatchEvent(new CustomEvent('nosee:store-updated', { detail }));
      try { window.localStorage.setItem('NOSEE_STORE_UPDATED_AT', String(detail.updatedAt)); } catch {}
    }
    setSaveMessage(ts.successUpdate);
  };

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const hasCoords = isPhysical
    && Number.isFinite(Number(localStore.latitude))
    && Number.isFinite(Number(localStore.longitude));

  const handleNavigate = useCallback((id) => {
    if (!id) return;
    onClose();
    navigate(`/publicaciones/${id}`);
  }, [onClose, navigate]);

  const bodyContent = (
    <div style={{ padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: isMobile ? '20px' : '24px' }}>

      {hasCoords && <MapsCtaButton store={localStore} isMobile={isMobile} />}

      {isPhysical && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SectionLabel>{td.evidences}</SectionLabel>
          {loadingPubs ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              {['ev-1', 'ev-2', 'ev-3', 'ev-4'].map((k, i) => <ShimmerCard key={k} height={88} delay={i * 0.1} />)}
            </div>
          ) : evidences.length === 0 ? (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{evidenceError || td.noEvidences}</p>
          ) : (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {evidences.map((ev) => (
                <EvidenceFrame key={ev.id} ev={ev} storeName={localStore.name} label={td.evidences} onExpand={setExpandedEvidence} />
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SectionLabel>{canEdit ? ts.editAddress : td.address}</SectionLabel>
        {isPhysical ? (
          <>
            <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <StoreMapPicker
                latitude={Number.isFinite(Number(editLatitude)) ? Number(editLatitude) : null}
                longitude={Number.isFinite(Number(editLongitude)) ? Number(editLongitude) : null}
                address={editAddress}
                readOnly={!canEdit}
                onLocationChange={({ latitude, longitude, address }) => {
                  setEditLatitude(Number.isFinite(Number(latitude)) ? String(Number(latitude)) : '');
                  setEditLongitude(Number.isFinite(Number(longitude)) ? String(Number(longitude)) : '');
                  if (typeof address === 'string') setEditAddress(address);
                }}
                onAddressChange={(value) => setEditAddress(value)}
              />
            </div>
            {canEdit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <SaveButton onClick={handleSaveStore} disabled={savingStore} label={savingStore ? ts.saving : ts.saveLocation} />
                {saveMessage && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{saveMessage}</span>}
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--text-muted)' }}>
            <GlobeIcon size={18} />
            <span>{td.noLocation}</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <SectionLabel>{td.featuredProducts}</SectionLabel>
        {loadingPubs ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {['pub-1', 'pub-2', 'pub-3'].map((k, i) => <ShimmerCard key={k} height={64} delay={i * 0.12} />)}
          </div>
        ) : publications.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '28px', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" style={{ color: 'var(--border-soft)' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>{td.noProducts}</p>
          </div>
        ) : (
          <div style={isMobile
            ? { display: 'flex', flexDirection: 'column', gap: '4px' }
            : { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }
          }>
            {publications.map((pub) => (
              <PublicationMini key={pub.id} pub={pub} isMobile={isMobile} onNavigate={handleNavigate} />
            ))}
          </div>
        )}
        {!loadingPubs && publications.length > 0 && (
          <button
            type="button"
            onMouseEnter={() => setVerTodosHov(true)}
            onMouseLeave={() => setVerTodosHov(false)}
            onClick={() => {
              onClose();
              navigate(`/?storeId=${localStore.id}&storeName=${encodeURIComponent(localStore.name)}`);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              padding: isMobile ? '12px 16px' : '10px 14px',
              background: verTodosHov ? 'var(--accent)' : 'var(--accent-soft)',
              border: '1px solid var(--accent)',
              borderRadius: 'var(--radius-md)',
              color: verTodosHov ? 'var(--bg-base)' : 'var(--accent)',
              fontSize: isMobile ? '14px' : '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s, color 0.2s',
              marginTop: '4px',
            }}
          >
            Ver todos ({publications.length}) →
          </button>
        )}
      </div>
    </div>
  );

  const lightbox = expandedEvidence && (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={td.evidences}
      style={{ position: 'fixed', inset: 0, background: 'var(--overlay-heavy)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, cursor: 'pointer' }}
      onClick={() => setExpandedEvidence(null)}
      onKeyDown={(e) => { if (e.key === 'Escape') setExpandedEvidence(null); }}
    >
      <button type="button" aria-label={td.close} onClick={() => setExpandedEvidence(null)}
        style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(15,23,36,0.9)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)', borderRadius: '50%', width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CloseIcon size={14} />
      </button>
      <img src={expandedEvidence} alt={localStore.name} style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 'var(--radius-md)', cursor: 'default' }} />
    </div>
  );

  /* ════════════════════════════════════════════════════
     MOBILE — Bottom Sheet
  ════════════════════════════════════════════════════ */
  if (isMobile) {
    return (
      <>
        <div
          role="dialog"
          aria-modal="true"
          aria-label={td.title}
          style={mob.overlay}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        >
          <div style={{ ...mob.sheet, borderTop: `3px solid ${accentColor}` }}>

            <div style={mob.handleWrap} onClick={onClose} role="button" aria-label={td.close} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onClose(); }}>
              <div style={mob.handle} />
            </div>

            <div style={mob.header}>
              <div style={mob.headerLeft}>
                <div style={{ ...mob.dot, background: accentColor, boxShadow: `0 0 6px ${accentColor}`, animation: 'sdm-pulse-dot 2s ease-in-out infinite' }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ width: '12px', height: '2px', borderRadius: '1px', background: accentColor, display: 'block' }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {isPhysical ? t.storesPage.physical : t.storesPage.virtual}
                    </span>
                  </div>
                  <h2 style={mob.storeName}>{localStore.name}</h2>
                </div>
              </div>
              <HeaderActions onReport={() => setReportOpen(true)} onClose={onClose} closeLabel={td.close} btnSize={34} />
            </div>

            <StoreInfoBar
              address={localStore.address}
              isPhysical={isPhysical}
              websiteUrl={localStore.website_url}
              visitWebsiteLabel={td.visitWebsite}
              style={mob.infoBar}
            />

            <div style={mob.body}>{bodyContent}</div>
          </div>
        </div>
        {lightbox}
        {reportOpen && (
          <ReportModal
            targetType="store"
            targetId={localStore.id}
            targetName={localStore.name}
            onClose={() => setReportOpen(false)}
          />
        )}
      </>
    );
  }

  /* ════════════════════════════════════════════════════
     DESKTOP — Modal centrado
  ════════════════════════════════════════════════════ */
  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={td.title}
        style={desk.overlay}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      >
        <div style={{ ...desk.modal, borderTop: `3px solid ${accentColor}` }}>

          <div style={desk.header}>
            <div style={desk.dotGrid} aria-hidden="true" />
            <div style={desk.headerContent}>
              <div style={desk.headerLeft}>
                <div style={{ ...desk.statusDot, background: accentColor, boxShadow: `0 0 8px ${accentColor}` }}>
                  <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: accentColor, animation: 'sdm-pulse-dot 2s ease-in-out infinite' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ width: '16px', height: '2px', borderRadius: '1px', background: accentColor, display: 'block' }} />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {isPhysical ? t.storesPage.physical : t.storesPage.virtual}
                    </span>
                  </div>
                  <h2 style={desk.storeName}>{localStore.name}</h2>
                </div>
              </div>
              <HeaderActions onReport={() => setReportOpen(true)} onClose={onClose} closeLabel={td.close} btnSize={30} />
            </div>

            <StoreInfoBar
              address={localStore.address}
              isPhysical={isPhysical}
              websiteUrl={localStore.website_url}
              visitWebsiteLabel={td.visitWebsite}
              style={desk.infoBar}
            />
          </div>

          {bodyContent}
        </div>
      </div>
      {lightbox}
      {reportOpen && (
        <ReportModal
          targetType="store"
          targetId={localStore.id}
          targetName={localStore.name}
          onClose={() => setReportOpen(false)}
        />
      )}
    </>
  );
}

/* ── Desktop styles ──────────────────────────────────── */
const desk = {
  overlay: { position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px', backdropFilter: 'blur(6px)' },
  modal: { background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg), 0 0 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', animation: 'sdm-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) both', border: '1px solid var(--border)' },
  header: { position: 'relative', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', overflow: 'hidden' },
  dotGrid: { position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(56,189,248,0.12) 1px, transparent 1px)', backgroundSize: '18px 18px', pointerEvents: 'none' },
  headerContent: { position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 20px 12px', gap: '12px' },
  headerLeft: { display: 'flex', alignItems: 'flex-start', gap: '14px', minWidth: 0 },
  statusDot: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, marginTop: '6px', position: 'relative' },
  storeName: { margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, letterSpacing: '-0.02em' },
  infoBar: { position: 'relative', display: 'flex', flexWrap: 'wrap', gap: '16px', padding: '10px 20px 14px', borderTop: '1px solid var(--border)', background: 'rgba(0,0,0,0.15)' },
};

/* ── Mobile styles ───────────────────────────────────── */
const mob = {
  overlay: { position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'flex-end', justifyContent: 'stretch', zIndex: 1000, backdropFilter: 'blur(6px)' },
  sheet: { background: 'var(--bg-surface)', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column', animation: 'sdm-sheet-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both', boxShadow: '0 -8px 40px rgba(0,0,0,0.5)' },
  handleWrap: { display: 'flex', justifyContent: 'center', padding: '12px 0 4px', cursor: 'pointer', flexShrink: 0 },
  handle: { width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border-soft)' },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '8px 16px 0', gap: '12px', flexShrink: 0 },
  headerLeft: { display: 'flex', alignItems: 'flex-start', gap: '10px', minWidth: 0, flex: 1 },
  dot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '5px', position: 'relative' },
  storeName: { margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, letterSpacing: '-0.02em' },
  infoBar: { display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '10px 16px 12px', borderBottom: '1px solid var(--border)', marginTop: '10px', flexShrink: 0 },
  body: { overflowY: 'auto', flex: 1, paddingBottom: 'env(safe-area-inset-bottom, 16px)' },
};
