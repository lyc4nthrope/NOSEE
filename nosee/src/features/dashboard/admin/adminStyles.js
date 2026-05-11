// ─── Estilos ──────────────────────────────────────────────────────────────────
export const CLOSE_BTN_STYLE = { flexShrink: 0, background: 'var(--bg-elevated)', border: '2px solid var(--border)', borderRadius: '50%', width: 44, height: 44, fontSize: 18, fontWeight: 800, cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 };
export const ACCENT  = 'var(--accent)';
export const BG      = 'var(--bg-base)';
export const SURFACE = 'var(--bg-surface)';
export const BORDER  = 'var(--border)';
export const TEXT    = 'var(--text-primary)';
export const MUTED   = 'var(--text-secondary)';

export const s = {
  root:    { display: 'flex', height: '100vh', overflow: 'hidden', background: BG, color: TEXT, fontFamily: "'DM Sans', 'Inter', sans-serif" },
  sidebar: { width: 224, background: SURFACE, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', padding: '24px 16px', height: '100%', flexShrink: 0 },
  nav:     { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: 14, fontWeight: 500, textAlign: 'left', transition: 'all 0.15s', minHeight: 44, minWidth: 44 },
  navActive:  { background: `${ACCENT}18`, color: ACCENT },
  navBadge:   { marginLeft: 'auto', background: 'var(--error)', color: '#ffffff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 },

  main:       { flex: 1, padding: '32px 40px', overflowY: 'auto', height: '100%' },
  header:     { marginBottom: 28 },
  headerTitle:{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.5px', textWrap: 'balance' },
  headerSub:  { color: MUTED, fontSize: 14, margin: '4px 0 0' },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 },
  statCard:  { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.2s ease', cursor: 'default' },
  statIcon:  { width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 12 },
  statValue: { fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: TEXT, lineHeight: 1.1, marginBottom: 4 },
  statLabel: { fontSize: 12, color: MUTED, fontWeight: 500, letterSpacing: '0.3px', textWrap: 'balance' },

  kpiSection:     { marginBottom: 32 },
  kpiSectionLabel:{ fontSize: 12, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 12, paddingLeft: 2, textWrap: 'balance' },
  kpiAlertCard:   { background: 'var(--warning-soft)', border: '1px solid var(--warning)', borderRadius: 12, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.04)', transition: 'all 0.2s ease' },
  kpiAlertIcon:   { fontSize: 20, width: 40, height: 40, borderRadius: 10, background: 'var(--warning)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  kpiAlertValue:  { fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--warning)', lineHeight: 1.1 },
  kpiAlertLabel:  { fontSize: 12, fontWeight: 600, color: 'var(--warning)', letterSpacing: '0.3px' },
  kpiLoadingSkeleton: { background: 'var(--bg-elevated)', borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite' },

  section:     { marginTop: 32 },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle:{ fontSize: 16, fontWeight: 600, textWrap: 'balance' },
  linkBtn:     { background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', fontSize: 13, fontWeight: 600, minHeight: 44, minWidth: 44 },

  filterRow: { display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  filterBtn:  { background: 'none', border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 7, padding: '6px 14px', fontSize: 13, cursor: 'pointer', minHeight: 44, minWidth: 44 },
  filterBtnActive: { background: `${ACCENT}18`, borderColor: ACCENT, color: ACCENT },

  table:     { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' },
  tableHead: { display: 'grid', gridTemplateColumns: '2fr 1fr 0.5fr 0.8fr 1fr', padding: '12px 20px', borderBottom: `1px solid ${BORDER}`, background: 'var(--bg-elevated)' },
  th:        { fontSize: 12, color: MUTED, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' },
  tableRow:  { display: 'grid', gridTemplateColumns: '2fr 1fr 0.5fr 0.8fr 1fr', padding: '14px 20px', alignItems: 'center', borderBottom: `1px solid ${BORDER}` },
  td:        { display: 'flex', alignItems: 'center', gap: 10 },
  tdNum:     { fontSize: 14, fontWeight: 600, color: ACCENT },
  rowAvatar: { width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-elevated)', color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 },
  rowName:   { fontSize: 14, fontWeight: 500 },
  rowEmail:  { fontSize: 12, color: MUTED },
  roleSelect:{ background: 'var(--bg-elevated)', border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 6, padding: '5px 8px', fontSize: 12, cursor: 'pointer', width: '100%', maxWidth: '100%', boxSizing: 'border-box' },
  badge:     { fontSize: 12, fontWeight: 600, borderRadius: 6, padding: '3px 10px', textTransform: 'capitalize' },
  actionBtn: { background: 'none', border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 6, padding: '5px 12px', fontSize: 13, cursor: 'pointer', minHeight: 44, minWidth: 44 },
  actionBtnDanger: { borderColor: 'var(--error)', color: 'var(--error)' },

  reportCard:    { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '18px 20px' },
  reportTop:     { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  severityBadge: { fontSize: 10, fontWeight: 700, borderRadius: 4, padding: '3px 8px', letterSpacing: '0.5px' },
  statusPill:    { fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'var(--bg-elevated)', color: MUTED, fontWeight: 700 },

  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 16 },
  summaryCard: { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '12px 14px' },
  summaryTitle: { margin: '0 0 8px', fontSize: 14 },
  summaryRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: MUTED, marginBottom: 6 },
  summaryEmpty: { margin: 0, color: MUTED, fontSize: 13 },
  reportFiltersGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 18 },
  filterLabelWrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  filterLabel: { fontSize: 12, color: MUTED, fontWeight: 600 },
  filterSelect: { background: 'var(--bg-elevated)', border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 7, padding: '8px 10px', fontSize: 13 },

  modalOverlay: { position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200, padding: 16 },
  descriptionBox: { margin: 0, fontSize: 14, color: TEXT, lineHeight: 1.5, background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: 8, border: `1px solid ${BORDER}` },
  modalCard: { width: 720, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 },
  detailGrid: { display: 'grid', gap: 10, marginBottom: 14 },
  detailRow: { display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10, fontSize: 13 },
  detailLabel: { color: MUTED },
  modalTextarea: { width: '100%', background: 'var(--bg-elevated)', border: `1px solid ${BORDER}`, color: TEXT, borderRadius: 8, padding: 10, fontSize: 13, resize: 'vertical' },


  btnDelete:  { background: 'var(--error-soft)', border: '1px solid var(--error)', color: 'var(--error)', borderRadius: 7, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  btnBan:     { background: 'var(--warning-soft)', border: '1px solid var(--warning)', color: 'var(--warning)', borderRadius: 7, padding: '7px 14px', fontSize: 13, cursor: 'pointer', fontWeight: 500 },
  btnDismiss: { background: 'none', border: `1px solid ${BORDER}`, color: MUTED, borderRadius: 7, padding: '7px 14px', fontSize: 13, cursor: 'pointer', minHeight: 44, minWidth: 44 },

  // Dealer applications
  dealerEmpty: { color: MUTED, fontSize: 14, padding: '24px 0' },
  dealerSectionTitle: { fontSize: 14, fontWeight: 600, color: MUTED, marginBottom: 12 },
  dealerError: { color: 'var(--error)', fontSize: 13, textAlign: 'center', margin: '8px 0' },
  dealerList: { display: 'flex', flexDirection: 'column', gap: '16px' },
  dealerSubList: { display: 'flex', flexDirection: 'column', gap: '10px' },
  dealerRow: { padding: '16px', border: `1px solid ${BORDER}`, borderRadius: 'var(--radius-lg)', background: SURFACE, display: 'flex', flexDirection: 'column', gap: '8px' },
  dealerRowHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' },
  dealerName: { margin: 0, fontWeight: 600, fontSize: 14, color: TEXT },
  dealerPhone: { margin: '2px 0 0', fontSize: 13, color: MUTED },
  dealerMotivation: { margin: 0, fontSize: 13, color: MUTED, fontStyle: 'italic' },
  dealerDate: { margin: 0, fontSize: 12, color: 'var(--text-muted, var(--text-secondary))' },
  dealerActions: { display: 'flex', gap: '8px', marginTop: '4px' },
  dealerRejectionReason: { margin: 0, fontSize: 12, color: 'var(--error)' },
  dealerBadge: { padding: '3px 10px', borderRadius: '999px', fontSize: 12, fontWeight: 600 },
  dealerBadgePending: { background: 'var(--warning-soft)', color: 'var(--warning)', border: '1px solid var(--warning)' },
  dealerBadgeApproved: { background: 'var(--success)18', color: 'var(--success)', border: '1px solid var(--success)' },
  dealerBadgeRejected: { background: 'var(--error-soft)', color: 'var(--error)', border: '1px solid var(--error)' },
  dealerBtnApprove: { padding: '7px 16px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--success)', color: '#fff', fontSize: 13, fontWeight: 600 },
  dealerBtnReject: { padding: '7px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--error)', background: 'transparent', color: 'var(--error)', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  dealerModalOverlay: { position: 'fixed', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 },
  dealerModalCard: { background: SURFACE, borderRadius: 'var(--radius-xl)', padding: '24px', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '14px' },
  dealerModalTitle: { margin: 0, fontSize: 16, fontWeight: 600, color: TEXT },
  dealerModalLabel: { fontSize: 13, fontWeight: 500, color: TEXT, display: 'block', marginBottom: 6 },
  dealerModalInput: { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 'var(--radius-md)', border: `1px solid ${BORDER}`, background: 'var(--bg-elevated)', color: TEXT, fontSize: 14, minHeight: '72px', resize: 'vertical', fontFamily: 'inherit' },
  dealerModalBtnRow: { display: 'flex', gap: '8px' },
  dealerModalConfirm: { flex: 1, padding: 10, borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--error)', color: '#fff', fontWeight: 600, cursor: 'pointer' },
  dealerModalCancel: { flex: 1, padding: 10, borderRadius: 'var(--radius-md)', border: `1px solid ${BORDER}`, background: 'transparent', color: TEXT, cursor: 'pointer' },

  configCard: { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' },
  configRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: `1px solid ${BORDER}` },
  configParam:{ fontSize: 14, fontWeight: 500, color: TEXT },
  configNote: { fontSize: 12, color: MUTED, marginTop: 2 },
  configValue:{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px' },
};
