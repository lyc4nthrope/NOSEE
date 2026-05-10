/**
 * PublicationCard.jsx
 *
 * Tarjeta Instagram-style para publicaciones de precio.
 * Se usa en el feed de PublicationsPage y HomePage.
 *
 * UBICACIÓN: src/features/publications/components/PublicationCard.jsx
 *
 * PROPS:
 * - publication: {Object} Datos de la publicación (normalizado: .product, .store, .user)
 * - onValidate: {Function} Callback al validar/upvote
 * - onDownvote: {Function} Callback al downvote
 * - onReport: {Function} Callback al reportar
 * - onDelete: {Function} Callback al eliminar
 * - onViewMore: {Function} Callback al ver más
 * - isAuthor: {boolean} Si el usuario es el autor
 * - isAdmin: {boolean} Si el usuario es admin
 * - isAuthenticated: {boolean} Opcional — para HomePage (requiere login para votar)
 * - onRequireAuth: {Function} Opcional — para HomePage (llamado si no está logueado)
 */

import { memo, useState, useEffect, useId } from 'react';
import { formatDistanceToNow } from '@/features/publications/utils/dateUtils';
import { useLanguage } from '@/contexts/LanguageContext';
import { ReportPublicationModal } from '@/features/publications/components/ReportPublicationModal';
import { optimizeCloudinaryUrl, buildCloudinarySrcSet } from '@/services/cloudinary';
import { useShoppingListStore } from '@/features/shopping-list/store/shoppingListStore';
import CelebrationOverlay from '@/components/ui/CelebrationOverlay';

const DotsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
  </svg>
);

export function PublicationCard({
  publication,
  onValidate,
  onDownvote,
  onReport,
  onDelete,
  onViewMore,
  isAuthor,
  isAdmin,
  isAuthenticated,
  onRequireAuth,
}) {
  const { t } = useLanguage();
  const tc = t.publicationCard;

  const addItem = useShoppingListStore((s) => s.addItem);
  const isInList = useShoppingListStore((s) =>
    s.items.some((i) => i.publicationId === publication?.id)
  );

  const [cardHovered, setCardHovered] = useState(false);
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isDownvoting, setIsDownvoting] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const photoModalId = useId();

  const handleAddToList = () => {
    if (isAuthenticated === false) {
      onRequireAuth?.();
      return;
    }
    if (!isInList) {
      const name = publication.product?.name || tc.unknownProduct;
      addItem(name, 1, {
        storeName: publication.store?.name || '',
        price: publication.price || null,
        publicationId: publication.id,
      });
    }
  };

  const handleValidate = async () => {
    if (isValidating || isDownvoting) return;
    if (isAuthenticated === false) { onRequireAuth?.(); return; }
    const wasAlreadyUpvoted = publication.user_vote === 1;
    setIsValidating(true);
    try {
      await onValidate?.(publication.id, publication.user_vote);
      if (!wasAlreadyUpvoted) setShowCelebration(true);
    } finally {
      setIsValidating(false);
    }
  };

  const handleDownvote = async () => {
    if (isDownvoting || isValidating) return;
    if (isAuthenticated === false) { onRequireAuth?.(); return; }
    const wasAlreadyDownvoted = publication.user_vote === -1;
    setIsDownvoting(true);
    try {
      await onDownvote?.(publication.id, publication.user_vote);
      if (!wasAlreadyDownvoted) setShowCelebration(true);
    } finally {
      setIsDownvoting(false);
    }
  };

  const handleReport = async ({ publicationId, reason, description, evidenceFile }) => {
    if (!reason || isReporting) return;
    setIsReporting(true);
    try {
      const result = await onReport?.(publicationId, { reason, description, evidenceFile });
      if (result?.success) setShowReportModal(false);
    } finally {
      setIsReporting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(tc.confirmDelete) || isDeleting) return;
    setShowMenu(false);
    setIsDeleting(true);
    try {
      await onDelete?.(publication.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const pubDate = publication?.timestamp || publication?.created_at;
  const [timeAgo, setTimeAgo] = useState(() =>
    pubDate ? formatDistanceToNow(pubDate, t.timeAgo) : ''
  );

  useEffect(() => {
    if (!pubDate) return;
    const ageMs = Date.now() - new Date(pubDate).getTime();
    // Posts con más de 1 hora no cambian su "hace X tiempo" en segundos — no necesitan intervalo
    if (ageMs > 60 * 60 * 1000) return;

    const update = () => {
      if (document.visibilityState === 'visible') {
        setTimeAgo(formatDistanceToNow(pubDate, t.timeAgo));
      }
    };
    // Recalculamos cada 30s para que los saltos de "segundos" → "minutos" se reflejen a tiempo.
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [pubDate, t.timeAgo]);

  useEffect(() => {
    if (!showMenu) return;
    const close = (e) => {
      if (!e.target.closest('[data-menu-container]')) setShowMenu(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showMenu]);

  useEffect(() => {
    if (!photoExpanded) return;
    const onKey = (e) => { if (e.key === 'Escape') setPhotoExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photoExpanded]);

  if (!publication) return <div>{tc.notAvailable}</div>;

  const productName = publication.product?.name || tc.unknownProduct;
  const productBrand =
    publication.product?.brand?.name ||
    publication.product?.brands?.name ||
    publication.product?.brand_name ||
    tc.noBrand;
  const unitValue =
    publication.product?.base_quantity != null &&
    (publication.product?.unit_type?.abbreviation || publication.product?.unit_type?.name)
      ? `${publication.product.base_quantity} ${publication.product.unit_type?.abbreviation || publication.product.unit_type?.name}`
      : publication.product?.unit_type?.abbreviation ||
        publication.product?.unit_type?.name ||
        tc.noUnit;

  const storeName = publication.store?.name || tc.noStore;

  const upActive = publication.user_vote === 1;
  const downActive = publication.user_vote === -1;
  const canDelete = isAuthor || isAdmin;

  const photoUrl = publication.photo_url || publication.photo;
  const resolvedPhoto = photoUrl
    ? (photoUrl.includes('res.cloudinary.com')
        ? optimizeCloudinaryUrl(photoUrl, { width: 600 })
        : photoUrl)
    : null;

  return (
    <article
      className="publication-card pub-card-hover"
      style={styles.card}
      onMouseEnter={() => setCardHovered(true)}
      onMouseLeave={() => setCardHovered(false)}
    >
      {/* ── IMAGE SECTION ── */}
      <div style={styles.imageContainer}>
        {resolvedPhoto ? (
          <img
            src={resolvedPhoto}
            srcSet={buildCloudinarySrcSet(photoUrl, [400, 600, 900]) || undefined}
            sizes="(max-width: 560px) calc(100vw - 40px), (max-width: 1023px) calc(50vw - 68px), calc(33vw - 72px)"
            alt={productName}
            data-pub-img=""
            style={styles.image}
            loading="lazy"
            decoding="async"
            onClick={() => setPhotoExpanded(true)}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div style={styles.imagePlaceholder} aria-hidden="true" />
        )}

        {/* Store name badge — top-right */}
        <div style={styles.priceBadge} aria-label={`Tienda: ${storeName}`}>
          {storeName}
        </div>

        {/* Price Drop badge — top-left (conditional) */}
        {publication.priceDropPercent > 0 && (
          <div style={styles.priceDropBadge} aria-label={`Bajó ${publication.priceDropPercent}%`}>
            ↓ {publication.priceDropPercent}%
          </div>
        )}

        {/* Dots menu — top-left, semitransparente */}
        <div
          style={{ ...styles.imageActionsRow, opacity: cardHovered ? 1 : 0.8 }}
          data-menu-container
          className="pub-card-menu-trigger"
        >
          <button
            type="button"
            aria-label="Más opciones"
            aria-expanded={showMenu}
            aria-haspopup="menu"
            style={styles.dotsBtn}
            onClick={() => setShowMenu((v) => !v)}
          >
            <DotsIcon />
          </button>

          {showMenu && (
            <div style={styles.dropdownMenu} role="menu">
              {/* Shopping list toggle */}
              <button
                type="button"
                role="menuitem"
                className="pub-dropdown-item"
                style={styles.dropdownItem}
                onClick={() => { handleAddToList(); setShowMenu(false); }}
              >
                {isInList ? tc.removeFromList : tc.addToList}
              </button>

              <div style={styles.dropdownDivider} />

              {/* Report — only if not author */}
              {!isAuthor && (
                <button
                  type="button"
                  role="menuitem"
                  className="pub-dropdown-item-danger"
                  style={styles.dropdownItemDanger}
                  onClick={() => {
                    setShowMenu(false);
                    if (isAuthenticated === false) { onRequireAuth?.(); return; }
                    setShowReportModal(true);
                  }}
                >
                  {tc.report}
                </button>
              )}

              {/* Delete (author/admin only) */}
              {canDelete && (
                <>
                  <div style={styles.dropdownDivider} />
                  <button
                    type="button"
                    role="menuitem"
                    className="pub-dropdown-item-danger"
                    style={styles.dropdownItemDanger}
                    onClick={handleDelete}
                    disabled={isDeleting}
                    aria-busy={isDeleting || undefined}
                  >
                    {isDeleting ? tc.deleting : tc.delete}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT SECTION ── */}
      <div style={styles.content}>
        {/* Clickable area: title, brand, unit, description */}
        <div
          style={{ cursor: onViewMore ? 'pointer' : 'default' }}
          onClick={() => onViewMore?.(publication.id)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && onViewMore) {
              onViewMore(publication.id);
            }
          }}
          role={onViewMore ? 'button' : undefined}
          tabIndex={onViewMore ? 0 : undefined}
          title={`${productName} - ${productBrand}`}
        >
          {/* Header: product name + category tag */}
          <div style={styles.contentHeader}>
            <div
              style={{
                ...styles.productTitle,
                color: cardHovered ? 'var(--accent)' : 'var(--text-primary)',
              }}
            >
              {productName}
              {productBrand !== tc.noBrand && (
                <><span style={styles.titleSep}> · </span><span style={styles.titleBrand}>{productBrand}</span></>
              )}
            </div>
            <span style={styles.priceTag} aria-label={`Precio: $${publication.price?.toLocaleString('es-CO')} COP`}>
              ${publication.price?.toLocaleString('es-CO')}
            </span>
          </div>

          {unitValue !== tc.noUnit && (
            <div style={styles.metaLine}>{unitValue}</div>
          )}
          {publication.description && (
            <p style={styles.description}>{publication.description}</p>
          )}
        </div>

        {/* ── FOOTER ROW ── */}
        <div style={styles.footer}>
          {/* Timestamp — left */}
          {timeAgo && (
            <div style={styles.timestamp}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              {timeAgo}
            </div>
          )}

          {/* Social signal chips — right */}
          <div style={styles.socialChips}>
            {/* Upvote chip */}
            <button
              type="button"
              aria-label={tc.validateLabel(productName)}
              aria-pressed={upActive}
              data-active={upActive}
              disabled={isValidating || isDownvoting}
              className="pub-chip-up"
              style={styles.chip}
              onClick={handleValidate}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={upActive ? "currentColor" : "none"} stroke={upActive ? "none" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={upActive ? styles.chipIconActive : styles.chipIcon} aria-hidden="true">
                <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/>
                <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
              </svg>
              <span>{publication.validated_count || 0}</span>
            </button>

            {/* Downvote chip */}
            <button
              type="button"
              aria-label={tc.downvoteLabel?.(productName) ?? `Votar negativamente ${productName}`}
              aria-pressed={downActive}
              data-active={downActive}
              disabled={isValidating || isDownvoting}
              className="pub-chip-down"
              style={styles.chip}
              onClick={handleDownvote}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill={downActive ? "currentColor" : "none"} stroke={downActive ? "none" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={downActive ? styles.chipIconActive : styles.chipIcon} aria-hidden="true">
                <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/>
                <path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/>
              </svg>
              <span>{publication.downvoted_count || 0}</span>
            </button>

            {/* Comment count chip — read-only */}
            <div
              style={{ ...styles.chip, cursor: 'default' }}
              aria-label={`${publication.comments_count || 0} comentarios`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={styles.chipIcon} aria-hidden="true">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              <span>{publication.comments_count || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <CelebrationOverlay
        visible={showCelebration}
        message={t.celebration?.vote ?? "¡Voto registrado!"}
        onDone={() => setShowCelebration(false)}
      />

      {showReportModal && (
        <ReportPublicationModal
          publication={publication}
          onClose={() => setShowReportModal(false)}
          onSubmit={handleReport}
        />
      )}

      {photoExpanded && resolvedPhoto && (
        <div
          id={photoModalId}
          role="dialog"
          aria-modal="true"
          aria-label={tc.photoExpandLabel(true, productName)}
          style={styles.photoModal}
          onClick={() => setPhotoExpanded(false)}
        >
          <button
            type="button"
            aria-label={tc.closePhotoLabel}
            onClick={() => setPhotoExpanded(false)}
            style={styles.photoModalClose}
          >
            ✕
          </button>
          <img
            src={photoUrl}
            alt={productName}
            style={styles.photoModalImg}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </article>
  );
}

const styles = {
  // ── CARD ─────────────────────────────────────────────
  card: {
    background: 'var(--bg-surface)',
    border: 'none',
    borderRadius: '12px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    boxShadow: 'none',
    height: '100%',
  },

  // ── IMAGE SECTION ─────────────────────────────────────
  imageContainer: {
    position: 'relative',
    height: '256px',
    overflow: 'hidden',
    background: 'var(--surface-container-highest, #192540)',
    flexShrink: 0,
  },

  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    cursor: 'zoom-in',
    transform: 'scale(1)',
    transition: 'transform 0.5s ease',
  },

  imagePlaceholder: {
    width: '100%',
    height: '100%',
    background: 'var(--surface-container-highest, #192540)',
  },

  // Store name badge — top-RIGHT (sobre la imagen)
  priceBadge: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: 'rgba(255,255,255,0.95)',
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: '600',
    boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
    lineHeight: 1.5,
    zIndex: 1,
    maxWidth: '140px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },

  // Price tag — en el content header (reemplaza categoryTag)
  priceTag: {
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 700,
    color: '#ffffff',
    background: 'var(--accent)',
    padding: '2px 10px',
    borderRadius: '6px',
    flexShrink: 0,
    whiteSpace: 'nowrap',
    letterSpacing: '-0.01em',
  },

  // Price Drop badge — top-LEFT below dots button (conditional)
  priceDropBadge: {
    position: 'absolute',
    top: '52px',
    left: '8px',
    background: '#9f0519',
    color: '#ffa8a3',
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    zIndex: 1,
  },

  // Dots menu row — top-left, semitransparente
  imageActionsRow: {
    position: 'absolute',
    top: '8px',
    left: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'opacity 0.2s ease',
    zIndex: 2,
  },

  dotsBtn: {
    width: '28px',
    height: '28px',
    minWidth: '44px',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    color: 'rgba(255,255,255,0.9)',
    transition: 'background 0.15s',
  },

  // ── DROPDOWN MENU ─────────────────────────────────────
  dropdownMenu: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    background: 'var(--surface-container-high, #141f38)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
    zIndex: 20,
    minWidth: '160px',
    overflow: 'hidden',
  },

  dropdownItem: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '10px 14px',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },

  dropdownItemDanger: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '10px 14px',
    border: 'none',
    background: 'transparent',
    color: 'var(--error)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },

  dropdownDivider: {
    height: '1px',
    background: 'rgba(255,255,255,0.06)',
    margin: '2px 0',
  },

  // ── CONTENT SECTION ───────────────────────────────────
  content: {
    padding: '20px 20px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '0',
    flexGrow: 1,
  },

  contentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
    marginBottom: '8px',
  },

  productTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    transition: 'color 0.2s ease',
  },

  titleSep: {
    color: 'var(--text-muted)',
    fontWeight: 400,
  },

  titleBrand: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },

  description: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    lineHeight: 1.5,
    marginBottom: '8px',
  },

  metaLine: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '4px',
  },

  // ── FOOTER ROW ────────────────────────────────────────
  footer: {
    marginTop: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: '6px',
    paddingBottom: '8px',
  },

  timestamp: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
  },

  timestampIcon: {
    fontSize: '16px',
    fontVariationSettings: "'FILL' 0, 'wght' 400",
    lineHeight: 1,
  },

  socialChips: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },

  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    fontWeight: 500,
    padding: '2px 0',
    transition: 'color 0.15s',
    minHeight: '32px',
    minWidth: '32px',
  },

  chipIcon: {
    fontSize: '18px',
    fontVariationSettings: "'FILL' 0, 'wght' 400",
    lineHeight: 1,
  },

  chipIconActive: {
    fontSize: '18px',
    fontVariationSettings: "'FILL' 1, 'wght' 400",
    lineHeight: 1,
  },

  // ── PHOTO MODAL (unchanged) ───────────────────────────
  photoModal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.88)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1200,
    padding: '24px',
    cursor: 'pointer',
  },

  photoModalClose: {
    position: 'absolute',
    top: '16px',
    right: '16px',
    background: 'rgba(0,0,0,0.75)',
    border: '2px solid rgba(255,255,255,0.7)',
    color: '#fff',
    fontWeight: 800,
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },

  photoModalImg: {
    maxWidth: '90vw',
    maxHeight: '85vh',
    objectFit: 'contain',
    borderRadius: '10px',
    boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
  },
};

export default memo(PublicationCard);
