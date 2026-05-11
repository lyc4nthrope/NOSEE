import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { reviewApplication } from '@/services/api/dealerApplications.api';
import { useLanguage } from '@/contexts/LanguageContext';
import { useClientDateOnlyFormat } from '../adminUtils';
import { s } from '../adminStyles';

const statusStyleMap = {
  pending:  s.dealerBadgePending,
  approved: s.dealerBadgeApproved,
  rejected: s.dealerBadgeRejected,
};

function StatusBadge({ status, td }) {
  const variant = statusStyleMap[status] ?? statusStyleMap.pending;
  const labels = { pending: td.dealerApplicationsTable.statusPending, approved: td.dealerApplicationsTable.statusApproved, rejected: td.dealerApplicationsTable.statusRejected };
  return (
    <span style={{ ...s.dealerBadge, ...variant }}>
      {labels[status] || status}
    </span>
  );
}

function ApplicationRow({ app, processing, onApprove, onOpenReject, td }) {
  const dateStr = useClientDateOnlyFormat(app.created_at);

  return (
    <div style={s.dealerRow}>
      <div style={s.dealerRowHeader}>
        <div>
          <p style={s.dealerName}>{app.full_name}</p>
          <p style={s.dealerPhone}>
            <Icon name="Phone" size={16} /> {app.phone}
            {app.applicant?.reputation_points > 0 && (
              <span style={{ marginLeft: '12px' }}><Icon name="Star" size={16} /> {app.applicant.reputation_points} pts</span>
            )}
          </p>
        </div>
        <StatusBadge status={app.status} td={td} />
      </div>

      {app.motivation && (
        <p style={s.dealerMotivation}>
          &ldquo;{app.motivation}&rdquo;
        </p>
      )}

      <p style={s.dealerDate}>
        {td.dealerApplicationsTable.requestedOn} {dateStr}
      </p>

      {app.status === 'pending' && (
        <div style={s.dealerActions}>
          <button
            onClick={() => onApprove(app)}
            disabled={processing === app.id}
            style={{
              ...s.dealerBtnApprove,
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
            style={s.dealerBtnReject}
            aria-label={td.dealerApplicationsTable.rejectAria}
          >
            {td.dealerApplicationsTable.rejectBtn}
          </button>
        </div>
      )}

      {app.status === 'rejected' && app.rejection_reason && (
        <p style={s.dealerRejectionReason}>
          {td.dealerApplicationsTable.motivationPrefix} {app.rejection_reason}
        </p>
      )}
    </div>
  );
}

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
      <p style={s.dealerEmpty}>
        {td.dealerApplicationsTable.empty}
      </p>
    );
  }

  return (
    <>
      {rejectionModal && (
        <div style={s.dealerModalOverlay}>
          <div style={s.dealerModalCard}>
            <h3 style={s.dealerModalTitle}>
              {td.dealerApplicationsTable.rejectModalTitle}
            </h3>
            <div>
              <label htmlFor="rejectionReason" style={s.dealerModalLabel}>
                {td.dealerApplicationsTable.rejectReasonLabel}
              </label>
              <textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder={td.dealerApplicationsTable.rejectReasonPlaceholder}
                style={s.dealerModalInput}
              />
            </div>
            <div style={s.dealerModalBtnRow}>
              <button
                onClick={handleRejectConfirm}
                style={s.dealerModalConfirm}
                aria-label={td.dealerApplicationsTable.confirmRejectBtn}
              >
                {td.dealerApplicationsTable.confirmRejectBtn}
              </button>
              <button
                onClick={() => { setRejectionModal(null); setRejectionReason(''); }}
                style={s.dealerModalCancel}
                aria-label={td.dealerApplicationsTable.cancelBtn}
              >
                {td.dealerApplicationsTable.cancelBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <p style={s.dealerError}>{errorMsg}</p>
      )}

      <div style={s.dealerList}>
        {pending.length > 0 && (
          <section>
            <h3 style={s.dealerSectionTitle}>
              {td.dealerApplicationsTable.sectionPending(pending.length)}
            </h3>
              <div style={s.dealerSubList}>
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
            <h3 style={{ ...s.dealerSectionTitle, marginTop: pending.length > 0 ? '8px' : 0 }}>
              {td.dealerApplicationsTable.sectionReviewed(reviewed.length)}
            </h3>
              <div style={s.dealerSubList}>
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
