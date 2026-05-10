import { useState, useCallback } from 'react';
import { getApplications } from '@/services/api/dealerApplications.api';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Hook de administración de solicitudes de repartidores.
 * Expone estado y acciones para cargar solicitudes de dealer.
 *
 * @returns {{
 *   applications: Array,
 *   setApplications: Function,
 *   applicationsLoading: boolean,
 *   applicationsLoaded: boolean,
 *   setApplicationsLoaded: Function,
 *   loadApplications: Function,
 * }}
 */
export default function useAdminDealers() {
  const { t } = useLanguage();
  const td = t.adminDashboard;

  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);
  const [applicationsLoaded, setApplicationsLoaded] = useState(false);

  const loadApplications = useCallback(async () => {
    setApplicationsLoading(true);
    const { success, data } = await getApplications();
    if (success) setApplications(data);
    setApplicationsLoading(false);
    setApplicationsLoaded(true);
  }, []);

  return {
    applications, setApplications,
    applicationsLoading, applicationsLoaded, setApplicationsLoaded,
    loadApplications,
  };
}
