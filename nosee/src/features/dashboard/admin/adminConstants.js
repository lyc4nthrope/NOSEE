import { UserRoleEnum } from '@/types';

// ─── Constantes de reportes ───────────────────────────────────────────────────
export const REPORT_SEVERITY = {
  offensive:   'alta',
  spam:        'media',
  fake_price:  'media',
  wrong_photo: 'baja',
};
export const SEVERITY_COLORS = {
  alta:  { bg: 'var(--error-soft)', text: 'var(--error)' },
  media: { bg: 'var(--warning-soft)', text: 'var(--warning)' },
  baja:  { bg: 'var(--info-soft)', text: 'var(--info)' },
};

// ─── Parámetros de reputación — valores por defecto del proyecto ─────────────
export const DEFAULT_REPUTATION_PARAMS = [
  { param: 'Puntos por upvote recibido',       value: '+5',  note: 'Cuando otro usuario valida tu publicación' },
  { param: 'Puntos por downvote recibido',      value: '-3',  note: 'Cuando otro usuario rechaza tu publicación' },
  { param: 'Puntos por publicar precio',        value: '+2',  note: 'Al crear una nueva publicación de precio' },
  { param: 'Umbral Usuario Verificado',         value: '10',  note: 'Mínimo de puntos para publicar sin restricciones' },
  { param: 'Umbral para rol Moderador',         value: '500', note: 'Puntos mínimos para asignación automática' },
  { param: 'Penalización por reporte aceptado', value: '-10', note: 'Cuando un reporte contra el usuario es validado' },
];
// NOTA: reputation_params se migró a Supabase tabla reputation_config.
// DEFAULT_REPUTATION_PARAMS se mantiene como fallback si la tabla está vacía.

export const ALL_ROLES = [UserRoleEnum.USUARIO, UserRoleEnum.MODERADOR, UserRoleEnum.ADMIN, UserRoleEnum.REPARTIDOR];
export const REPORT_STATUS_OPTIONS = ['PENDING', 'IN_REVIEW', 'RESOLVED', 'REJECTED'];

export const REPORT_REASON_LABELS = {
  fake_price: 'Precio falso',
  wrong_photo: 'Foto incorrecta',
  spam: 'Spam',
  offensive: 'Ofensivo',
  other: 'Otro',
};

export const getReportTargetTypeLabel = (type, td) => {
  const map = td?.reportTargetTypes || {};
  return map[String(type || '').toLowerCase()] || td?.reportTargetTypes?.other || 'Other';
};

export const getReportTargetDisplay = (report) => {
  const type = String(report?.reported_type || '').toLowerCase();
  const target = report?.target;
  if (!target) return `ID: ${report?.reported_id || 'N/A'}`;

  if (type === 'publication') {
    const product = target?.product?.name || 'Publicación';
    const store = target?.store?.name ? ` • ${target.store.name}` : '';
    return `${product}${store}`;
  }
  if (type === 'user') return target?.full_name || report?.reported?.full_name || `Usuario ${report?.reported_id || ''}`;
  if (type === 'store') return target?.name || `Tienda ${report?.reported_id || ''}`;
  if (type === 'product') return target?.name || `Producto ${report?.reported_id || ''}`;
  if (type === 'brand') return target?.name || `Marca ${report?.reported_id || ''}`;
  if (type === 'comment') return target?.content ? `"${target.content}"` : `Comentario ${report?.reported_id || ''}`;

  return `ID: ${report?.reported_id || 'N/A'}`;
};

export const formatPublicationSummary = (publication, locale = 'es-CO') => {
  if (!publication) return null;

  const productName = publication.product?.name || 'N/A';
  const quantity = publication.product?.base_quantity;
  const unit = publication.product?.unit_type?.abbreviation || publication.product?.unit_type?.name;
  const brand = publication.product?.brand?.name || 'N/A';
  const store = publication.store?.name || 'N/A';
  const price = publication.price;

  return {
    productName,
    unit: quantity && unit ? `${quantity} ${unit}` : 'N/A',
    brand,
    store,
    price: typeof price === 'number' ? price.toLocaleString(locale, { style: 'currency', currency: 'COP' }) : 'N/A',
  };
};

export const normalizePublicationForAdmin = (publication) => ({
  ...publication,
  authorName: publication?.user?.full_name || null,
  userName: publication?.user?.full_name || null,
  userId: publication?.user?.id || publication?.user_id || null,
  productName: publication?.product?.name || null,
  productId: publication?.product?.id || publication?.product_id || null,
  productBarcode: publication?.product?.barcode || null,
  brandId: publication?.product?.brand?.id || null,
  brandName: publication?.product?.brand?.name || null,
  storeName: publication?.store?.name || null,
  storeId: publication?.store?.id || publication?.store_id || null,
  createdAt: publication?.created_at || null,
  photoUrl: publication?.photo_url || null,
  confidenceScore: publication?.confidence_score ?? null,
  status: publication?.is_active ? 'active' : 'hidden',
});

export const isPublicationVisible = (publication) => publication?.is_active === true;
export const isPublicationHidden = (publication) => !isPublicationVisible(publication);

export const normalizeReportStatus = (status) => String(status || 'PENDING').toUpperCase();
