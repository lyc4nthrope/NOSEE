import { lazy, Suspense } from 'react';
import { SectionHeader } from './AdminPrimitives';
import AdminLogTable from './AdminLogTable';

const LogsPanel = lazy(() => import('./LogsPanel'));

export default function AdminLogsSection({
  loginLogs, activityLogs, actionLogs, usersMap, logsLoading,
  logFilter, setLogFilter,
  logCatFilter, setLogCatFilter,
  logSourceFilter, setLogSourceFilter,
  logDateFrom, setLogDateFrom,
  logDateTo, setLogDateTo,
  td,
}) {
  return (
    <>
      <SectionHeader title={td.logsTitle} sub={td.logsSub} />
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Cargando…</div>}>
        <LogsPanel />
      </Suspense>

      <AdminLogTable
        loginLogs={loginLogs}
        activityLogs={activityLogs}
        actionLogs={actionLogs}
        usersMap={usersMap}
        logsLoading={logsLoading}
        logFilter={logFilter}
        setLogFilter={setLogFilter}
        logCatFilter={logCatFilter}
        setLogCatFilter={setLogCatFilter}
        logSourceFilter={logSourceFilter}
        setLogSourceFilter={setLogSourceFilter}
        logDateFrom={logDateFrom}
        setLogDateFrom={setLogDateFrom}
        logDateTo={logDateTo}
        setLogDateTo={setLogDateTo}
      />
    </>
  );
}
