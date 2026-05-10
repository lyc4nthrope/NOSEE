import { useState } from 'react';
import { reviewApplication } from '@/services/api/dealerApplications.api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useClientDateOnlyFormat } from '../adminUtils';

const STATUS_BADGE_STYLES = {
  pending:  { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  approved: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  rejected: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
};

function StatusBadge({ status, td }) {
  const s = STATUS_BADGE_STYLES[status] ?? STATUS_BADGE_STYLES.pending;
  const labels = { pending: td.dealerApplicationsTable.statusPending, approved: td.dealerApplicationsTable.statusApproved, rejected: td.dealerApplicationsTable.statusRejected };
  return (
    <span style={{
      padding: '3px 10px',
      borderRadius: '999px',
      fontSize: '12px',
      fontWeight: '600',
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
    }}>
      {labels[status] || status}
    </span>
  );
}

function ApplicationRow({ app, processing, onApprove, onOpenReject, td }) {
  const dateStr = useClientDateOnlyFormat(app.created_at);

  return (
    <div style={rowStyles.container}>
      <div style={rowStyles.header}>
        <div>
          <p style={rowStyles.name}>{app.full_name}</p>
          <p style={rowStyles.phone}>
            📞 {app.phone}
            {app.applicant?.reputation_points > 0 && (
              <span style={{ marginLeft: '12px' }}>⭐ {app.applicant.reputation_points} pts</span>
            )}
          </p>
        </div>
        <StatusBadge status={app.status} td={td} />
      </div>

      {app.motivation && (
        <p style={rowStyles.motivation}>
          &ldquo;{app.motivation}&rdquo;
        </p>
      )}

      <p style={rowStyles.date}>
        {td.dealerApplicationsTable.requestedOn} {dateStr}
      </p>

      {app.status === 'pending' && (
        <div style={rowStyles.actions}>
          <button
            onClick={() => onApprove(app)}
            disabled={processing === app.id}
            style={{
              ...actionBtnStyles.approve,
              opacity: processing === app.id ? 0.6 : 1,
              cursor: processing === app.id ? 'not-allowed' : 'pointer',
            }}
            aria-label={td.dealerApplicationsTable.approveAria}
          >
            {processing === app.id ? td.dealerApplicationsTable.processingBtn : td.dealerApplicationsTable.approveBtn}
          </button>
          <button
            onClick={() => onOpenReject(app)}
            disabled={processing === app.id}
            style={actionBtnStyles.reject}
            aria-label={td.dealerApplicationsTable.rejectAria}
          >
            {td.dealerApplicationsTable.rejectBtn}
          </button>
        </div>
      )}

      {app.status === 'rejected' && app.rejection_reason && (
        <p style={rowStyles.rejectionReason}>
          {td.dealerApplicationsTable.motivationPrefix} {app.rejection_reason}
        </p>
      )}
    </div>
  );
}

const rowStyles = {
  container: {
    padding: '16px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-surface)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '12px',
    flexWrap: 'wrap',
  },
  name: {
    margin: 0,
    fontWeight: '600',
    fontSize: '14px',
    color: 'var(--text-primary)',
  },
  phone: {
    margin: '2px 0 0',
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  motivation: {
    margin: 0,
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
  },
  date: {
    margin: 0,
    fontSize: '12px',
    color: 'var(--text-muted, var(--text-secondary))',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '4px',
  },
  rejectionReason: {
    margin: 0,
    fontSize: '12px',
    color: '#991b1b',
  },
};

const actionBtnStyles = {
  approve: {
    padding: '7px 16px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: '#065f46',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
  },
  reject: {
    padding: '7px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid #fca5a5',
    background: 'transparent',
    color: '#991b1b',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};

const modalStyles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '16px',
  },
  card: {
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-xl)',
    padding: '24px',
    width: '100%',
    maxWidth: '400px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    minHeight: '72px',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  confirmBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: '#991b1b',
    color: '#fff',
    fontWeight: '600',
    cursor: 'pointer',
  },
  cancelBtn: {
    flex: 1,
    padding: '10px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-primary)',
    cursor: 'pointer',
  },
};

export function DealerApplicationsTable({ applications, onReviewed }) {
  const { t } = useLanguage();
  const td = t.adminDashboard;

  const [rejectionModal, setRejectionModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const pending = applications.filter((a) => a.status === 'pending');
  const reviewed = applications.filter((a) => a.status !== 'pending');

  const handleApprove = async (app) => {
    setProcessing(app.id);
    setErrorMsg('');
    const { success, error } = await reviewApplication(app.id, 'approved', {
      applicantUserId: app.user_id,
    });
    setProcessing(null);
    if (!success) { setErrorMsg(td.dealerApplicationsTable.errorApprove(error)); return; }
    onReviewed?.();
  };

  const handleRejectConfirm = async () => {
    if (!rejectionModal) return;
    setProcessing(rejectionModal.applicationId);
    setErrorMsg('');
    const { success, error } = await reviewApplication(
      rejectionModal.applicationId,
      'rejected',
      { applicantUserId: rejectionModal.applicantUserId, rejectionReason }
    );
    setProcessing(null);
    setRejectionModal(null);
    setRejectionReason('');
    if (!success) { setErrorMsg(td.dealerApplicationsTable.errorReject(error)); return; }
    onReviewed?.();
  };

  if (applications.length === 0) {
    return (
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', padding: '24px 0' }}>
        {td.dealerApplicationsTable.empty}
      </p>
    );
  }

  return (
    <>
      {/* Modal de rechazo */}
      {rejectionModal && (
        <div style={modalStyles.overlay}>
          <div style={modalStyles.card}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>
              {td.dealerApplicationsTable.rejectModalTitle}
            </h3>
            <div>
              <label htmlFor="rejectionReason" style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                {td.dealerApplicationsTable.rejectReasonLabel}
              </label>
              <textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={td.dealerApplicationsTable.rejectReasonPlaceholder}
                style={modalStyles.input}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleRejectConfirm}
                style={modalStyles.confirmBtn}
                aria-label={td.dealerApplicationsTable.confirmRejectBtn}
              >
                {td.dealerApplicationsTable.confirmRejectBtn}
              </button>
              <button
                onClick={() => { setRejectionModal(null); setRejectionReason(''); }}
                style={modalStyles.cancelBtn}
                aria-label={td.dealerApplicationsTable.cancelBtn}
              >
                {td.dealerApplicationsTable.cancelBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <p style={{ color: '#991b1b', fontSize: 13, textAlign: 'center', margin: '8px 0' }}>{errorMsg}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {pending.length > 0 && (
          <section>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px' }}>
              {td.dealerApplicationsTable.sectionPending(pending.length)}
            </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pending.map((app) => (
                  <ApplicationRow
                    key={app.id}
                    app={app}
                    processing={processing}
                    onApprove={handleApprove}
                    onOpenReject={() => setRejectionModal({ applicationId: app.id, applicantUserId: app.user_id })}
                    td={td}
                  />
                ))}
            </div>
          </section>
        )}

        {reviewed.length > 0 && (
          <section>
            <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '12px', marginTop: pending.length > 0 ? '8px' : 0 }}>
              {td.dealerApplicationsTable.sectionReviewed(reviewed.length)}
            </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {reviewed.map((app) => (
                  <ApplicationRow
                    key={app.id}
                    app={app}
                    processing={processing}
                    onApprove={handleApprove}
                    onOpenReject={() => setRejectionModal({ applicationId: app.id, applicantUserId: app.user_id })}
                    td={td}
                  />
                ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
