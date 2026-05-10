import { BanModal } from '../modals/BanModal';
import { ConfirmModal } from './ConfirmModal';

export default function AdminModalsSection({
  banModal, confirmBan, setBanModal,
  confirmModal, setConfirmModal,
}) {
  return (
    <>
      {banModal && (
        <BanModal
          user={banModal}
          onConfirm={confirmBan}
          onCancel={() => setBanModal(null)}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        actions={confirmModal.actions}
        onConfirm={() => { confirmModal.onConfirm?.(); setConfirmModal({ isOpen: false, actions: null }); }}
        onCancel={() => setConfirmModal({ isOpen: false, actions: null })}
      />
    </>
  );
}
