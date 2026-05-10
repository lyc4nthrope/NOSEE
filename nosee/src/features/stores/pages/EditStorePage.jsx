import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StoreForm from '@/features/stores/components/StoreForm';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuthStore, selectAuthUser } from '@/features/auth/store/authStore';
import * as storesApi from '@/services/api/stores.api';

export default function EditStorePage() {
  const { t } = useLanguage();
  const te = t.editStorePage;
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useAuthStore(selectAuthUser);

  const [permissionStatus, setPermissionStatus] = useState('loading'); // 'loading' | 'allowed' | 'denied'

  useEffect(() => {
    if (!id) return;
    if (!currentUser) {
      setPermissionStatus('denied');
      return;
    }

    const role = currentUser.role;
    if (role === 'Admin' || role === 'Moderador') {
      setPermissionStatus('allowed');
      return;
    }

    storesApi.getStore(id).then((result) => {
      if (!result.success) {
        setPermissionStatus('denied');
        return;
      }
      const isOwner = result.data.created_by === currentUser.id;
      setPermissionStatus(isOwner ? 'allowed' : 'denied');
    });
  }, [id, currentUser]);

  if (!id) {
    return (
      <section style={styles.page}>
        <div style={{ color: 'var(--error)', fontSize: '14px' }}>
          {te.invalidId}
        </div>
      </section>
    );
  }

  if (permissionStatus === 'loading') {
    return (
      <section style={styles.page}>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Verificando permisos...
        </div>
      </section>
    );
  }

  if (permissionStatus === 'denied') {
    return (
      <section style={styles.page}>
        <div style={styles.denied}>
          <span style={{ fontSize: '32px' }}>🚫</span>
          <h2 style={styles.deniedTitle}>Sin permiso</h2>
          <p style={styles.deniedText}>
            Solo el creador de la tienda, un moderador o un administrador puede editarla.
          </p>
          <button type="button" style={styles.backBtn} onClick={() => navigate('/tiendas')}>
            Volver a tiendas
          </button>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>{te.title}</h1>
        <p style={styles.subtitle}>
          {te.subtitle}
        </p>
      </header>

      <StoreForm
        mode="edit"
        storeId={id}
        onSuccess={() => navigate(-1)}
      />
    </section>
  );
}

const styles = {
  page: {
    width: '100%',
    padding: '24px 16px 32px',
    display: 'grid',
    gap: '16px',
  },
  header: {
    width: '100%',
    maxWidth: '760px',
    margin: '0 auto',
  },
  title: {
    margin: 0,
    fontSize: '30px',
    fontWeight: 800,
    color: 'var(--text-primary)',
  },
  subtitle: {
    margin: '8px 0 0',
    color: 'var(--text-secondary)',
  },
  denied: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    padding: '48px 16px',
    textAlign: 'center',
  },
  deniedTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  deniedText: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--text-secondary)',
    maxWidth: '320px',
  },
  backBtn: {
    marginTop: '8px',
    padding: '8px 20px',
    background: 'var(--accent)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius-sm, 6px)',
    fontWeight: 600,
    fontSize: '14px',
    cursor: 'pointer',
  },
};
