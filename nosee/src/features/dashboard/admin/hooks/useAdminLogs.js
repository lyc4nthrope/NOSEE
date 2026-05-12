import { useState, useCallback, useEffect } from 'react';
import { useAdminStore, selectActiveSection } from '../store/adminStore';
import { getActionLogs, getLoginLogs, getUserActivityLogs } from '@/services/api/audit.api';
import { getAllUsers, getUserBasicInfo } from '@/services/api/users.api';
import { supabase } from '@/services/supabase.client';

/**
 * Hook de administración de logs de actividad, login y acciones de admin.
 * Suscribe a cambios en tiempo real cuando la sección activa es 'logs'.
 *
 * @param {Object} [params]
 * @param {string} [params.activeSection] - Sección actual del dashboard
 * @returns {{
 *   actionLogs: Array,
 *   setActionLogs: Function,
 *   loginLogs: Array,
 *   setLoginLogs: Function,
 *   logsLoading: boolean,
 *   logsLoaded: boolean,
 *   activityLogs: Array,
 *   setActivityLogs: Function,
 *   usersMap: Object,
 *   setUsersMap: Function,
 *   logFilter: string,
 *   setLogFilter: Function,
 *   logCatFilter: string,
 *   setLogCatFilter: Function,
 *   logSourceFilter: string,
 *   setLogSourceFilter: Function,
 *   logDateFrom: string,
 *   setLogDateFrom: Function,
 *   logDateTo: string,
 *   setLogDateTo: Function,
 *   loadLogs: Function,
 * }}
 */
export default function useAdminLogs() {
  const [actionLogs, setActionLogs] = useState([]);
  const [loginLogs, setLoginLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [activityLogs, setActivityLogs] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [logFilter, setLogFilter] = useState('');
  const [logCatFilter, setLogCatFilter] = useState('all');
  const [logSourceFilter, setLogSourceFilter] = useState('all');
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const activeSection = useAdminStore(selectActiveSection);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    const [{ data: aLogs }, { data: lLogs }, { data: uLogs }] = await Promise.all([
      getActionLogs({ limit: 100 }),
      getLoginLogs({ limit: 200 }),
      getUserActivityLogs({ limit: 200 }),
    ]);
    setActionLogs(aLogs || []);
    setLoginLogs(lLogs || []);
    setActivityLogs(uLogs || []);

    const { data: allUsersData } = await getAllUsers();
    if (allUsersData?.length) {
      const map = {};
      allUsersData.forEach(u => {
        map[u.id] = u.fullName || u.full_name || u.email || `${u.id.slice(0, 8)}…`;
      });
      setUsersMap(map);
    }

    setLogsLoading(false);
    setLogsLoaded(true);
  }, []);

  useEffect(() => {
    if (activeSection !== 'logs') return;

    const fetchUserName = async (userId) => {
      if (!userId) return;
      const result = await getUserBasicInfo(userId);
      if (result.success && result.data) {
        const d = result.data;
        setUsersMap(prev => ({ ...prev, [d.id]: d.full_name || d.email || `${d.id.slice(0, 8)}…` }));
      }
    };

    const channel = supabase
      .channel('realtime-audit-logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_activity_logs' }, async (payload) => {
        setActivityLogs(prev => [payload.new, ...prev].slice(0, 500));
        fetchUserName(payload.new.user_id);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'login_audit_logs' }, async (payload) => {
        setLoginLogs(prev => [payload.new, ...prev].slice(0, 500));
        fetchUserName(payload.new.user_id);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_content_audit_log' }, (payload) => {
        const log = payload.new;
        setActionLogs(prev => [{ ...log, details: { resource_id: log.resource_id, resource_type: log.resource_type, ...(log.metadata || {}) } }, ...prev].slice(0, 500));
        fetchUserName(log.actor_user_id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeSection]);

  return {
    actionLogs, setActionLogs,
    loginLogs, setLoginLogs,
    logsLoading,
    logsLoaded,
    activityLogs, setActivityLogs,
    usersMap, setUsersMap,
    logFilter, setLogFilter,
    logCatFilter, setLogCatFilter,
    logSourceFilter, setLogSourceFilter,
    logDateFrom, setLogDateFrom,
    logDateTo, setLogDateTo,
    loadLogs,
  };
}
