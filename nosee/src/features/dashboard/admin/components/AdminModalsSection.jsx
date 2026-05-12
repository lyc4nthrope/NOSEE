import { BanModal } from '../modals/BanModal';
import { ConfirmModal } from './ConfirmModal';
import { useAdminStore, selectConfirmModal, selectBanModal } from '../store/adminStore';

export default function AdminModalsSection({
  confirmBan,
}) {
  const confirmModal = useAdminStore(selectConfirmModal);
  const banModal = useAdminStore(selectBanModal);

  return (
    <>
      {banModal && (
        <BanModal
          user={banModal}
          onConfirm={confirmBan}
          onCancel={() => useAdminStore.getState().setBanModal(null)}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        actions={confirmModal.actions}
        onConfirm={() => { confirmModal.onConfirm?.(); useAdminStore.getState().closeConfirmModal(); }}
        onCancel={() => useAdminStore.getState().closeConfirmModal()}
      />
    </>
  );
}
