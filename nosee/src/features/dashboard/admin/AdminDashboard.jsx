import { useEffect, lazy } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { s } from './adminStyles';

import AdminSidebar from './components/AdminSidebar';
import AdminUsersSection from './components/AdminUsersSection';
import AdminContentSection from './components/AdminContentSection';
import AdminReportsSection from './components/AdminReportsSection';
import AdminCatalogSection from './components/AdminCatalogSection';
import AdminLogsSection from './components/AdminLogsSection';
import AdminDealersSection from './components/AdminDealersSection';
import AdminPanelSection from './components/AdminPanelSection';
import AdminModalsSection from './components/AdminModalsSection';

const OverviewPanel = lazy(() => import('./components/OverviewPanel'));
const OrdersPanel = lazy(() => import('./components/OrdersPanel'));
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));



import useAdminUsers from './hooks/useAdminUsers';
import useAdminPublications from './hooks/useAdminPublications';
import useAdminReports from './hooks/useAdminReports';
import useAdminLogs from './hooks/useAdminLogs';
import useAdminDealers from './hooks/useAdminDealers';
import useAdminConfirmHandlers from './hooks/useAdminConfirmHandlers';
import { useAdminSessionTimeout } from './hooks/useAdminSessionTimeout';
import { useAdminStore, selectActiveSection } from './store/adminStore';

export default function AdminDashboard() {
  useAdminSessionTimeout();
  const { t } = useLanguage();
  const td = t.adminDashboard;
  const activeSection = useAdminStore(selectActiveSection);

  const {
    publications, setPublications, pubsLoading, pubsLoaded,
    pubFilter, setPubFilter,
    deletingPub,
    deletingStoreId, deletingBrandId, deletingProductId,
    unpublishedLoading, unpublishedLoaded, unpublishedResources,
    loadPublications, executeDeletePublication,
    handleEditPublication,
    handleViewStore, handleExecuteDeleteStore, handleEditStore,
    handleViewBrand, handleExecuteDeleteBrand, handleEditBrand,
    handleViewProduct, handleExecuteDeleteProduct, handleEditProduct,
    loadUnpublishedResources,
  } = useAdminPublications();

  const {
    users, usersLoading, usersError,
    changingRole,
    loadUsers, handleRoleChange, handleBanToggle, confirmBan,
  } = useAdminUsers({ pubsLoaded, setPublications });

  const {
    reports, reportsLoaded,
    reportStatusFilter, setReportStatusFilter,
    reportTypeFilter, setReportTypeFilter,
    reportSort, setReportSort,
    reportTypeOptions,
    filteredReports,
    loadReports, updateReportData, handleQuickAction,
  } = useAdminReports();

  const {
    actionLogs, loginLogs, logsLoading, logsLoaded, activityLogs, usersMap,
    logFilter, setLogFilter,
    logCatFilter, setLogCatFilter,
    logSourceFilter, setLogSourceFilter,
    logDateFrom, setLogDateFrom,
    logDateTo, setLogDateTo,
    loadLogs,
  } = useAdminLogs();

  const {
    applications, applicationsLoading, applicationsLoaded,
    loadApplications, setApplicationsLoaded,
  } = useAdminDealers();

  useEffect(() => {
    loadUsers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeSection === 'content'  && !pubsLoaded)     loadPublications();
    if (activeSection === 'content'  && pubFilter === 'unpublished' && !unpublishedLoaded) loadUnpublishedResources();
    if (activeSection === 'reports'  && !reportsLoaded)  loadReports();
    if (activeSection === 'logs'     && !logsLoaded)     loadLogs();
    if (activeSection === 'dealers'  && !applicationsLoaded) loadApplications();
  }, [activeSection, pubFilter, pubsLoaded, unpublishedLoaded, reportsLoaded, logsLoaded, applicationsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const { handleDeletePublication, handleDeleteStore, handleDeleteBrand, handleDeleteProduct } = useAdminConfirmHandlers({
    publications, td,
    executeDeletePublication,
    handleExecuteDeleteStore,
    handleExecuteDeleteBrand,
    handleExecuteDeleteProduct,
  });

  const reportsBadge = reports.filter(r => ['PENDING', 'IN_REVIEW'].includes(String(r.status).toUpperCase())).length || null;
  const navSections = [
    { key: 'overview', icon: 'LayoutDashboard', label: td.navOverview },
    { key: 'users',    icon: 'Users', label: td.navUsers },
    { key: 'content',  icon: 'Newspaper', label: td.navContent },
    { key: 'catalog',  icon: 'ClipboardList', label: 'Catálogo' },
    { key: 'orders',   icon: 'Package', label: 'Pedidos' },
    { key: 'reports',  icon: 'AlertTriangle', label: td.navReports, badge: reportsBadge },
    { key: 'dealers',  icon: 'Bike', label: 'Repartidores', badge: applications.filter(a => String(a.status || '').toLowerCase() === 'pending').length || null },
    { key: 'config',   icon: 'Settings', label: td.navConfig },
    { key: 'logs',     icon: 'ScrollText', label: td.navLogs },
  ];

  return (
    <div style={s.root} className="admin-root">
      <AdminSidebar navSections={navSections} />

      <main aria-label="Panel de administración" style={s.main} className="admin-main">

        {activeSection === 'overview' && (
          <AdminPanelSection title={td.overviewTitle} sub={td.overviewSub}><OverviewPanel /></AdminPanelSection>
        )}

        {activeSection === 'users' && (
          <AdminUsersSection
            users={users}
            usersLoading={usersLoading}
            usersError={usersError}
            loadUsers={loadUsers}
            handleRoleChange={handleRoleChange}
            handleBanToggle={handleBanToggle}
            changingRole={changingRole}
            td={td}
          />
        )}

        {activeSection === 'content' && (
          <AdminContentSection
            publications={publications}
            pubsLoading={pubsLoading}
            pubsLoaded={pubsLoaded}
            pubFilter={pubFilter}
            setPubFilter={setPubFilter}
            unpublishedLoading={unpublishedLoading}
            unpublishedResources={unpublishedResources}
            deletingPub={deletingPub}
            deletingStoreId={deletingStoreId}
            deletingBrandId={deletingBrandId}
            deletingProductId={deletingProductId}
            handleDeletePublication={handleDeletePublication}
            handleEditPublication={handleEditPublication}
            handleViewStore={handleViewStore}
            handleDeleteStore={handleDeleteStore}
            handleEditStore={handleEditStore}
            handleViewBrand={handleViewBrand}
            handleDeleteBrand={handleDeleteBrand}
            handleEditBrand={handleEditBrand}
            handleViewProduct={handleViewProduct}
            handleDeleteProduct={handleDeleteProduct}
            handleEditProduct={handleEditProduct}
            td={td}
          />
        )}

        {activeSection === 'catalog' && (
          <AdminCatalogSection
            deletingStoreId={deletingStoreId}
            deletingBrandId={deletingBrandId}
            deletingProductId={deletingProductId}
            handleViewStore={handleViewStore}
            handleDeleteStore={handleDeleteStore}
            handleEditStore={handleEditStore}
            handleViewBrand={handleViewBrand}
            handleDeleteBrand={handleDeleteBrand}
            handleEditBrand={handleEditBrand}
            handleViewProduct={handleViewProduct}
            handleDeleteProduct={handleDeleteProduct}
            handleEditProduct={handleEditProduct}
          />
        )}

        {activeSection === 'orders' && (
          <AdminPanelSection title="Pedidos" sub="Gestión de pedidos y pagos"><OrdersPanel /></AdminPanelSection>
        )}

        {activeSection === 'reports' && (
          <AdminReportsSection
            reports={reports}
            reportStatusFilter={reportStatusFilter}
            setReportStatusFilter={setReportStatusFilter}
            reportTypeFilter={reportTypeFilter}
            setReportTypeFilter={setReportTypeFilter}
            reportSort={reportSort}
            setReportSort={setReportSort}
            filteredReports={filteredReports}
            handleQuickAction={handleQuickAction}
            updateReportData={updateReportData}
            reportTypeOptions={reportTypeOptions}
            td={td}
          />
        )}

        {activeSection === 'config' && (
          <AdminPanelSection title={td.configTitle} sub={td.configSub}><SettingsPanel /></AdminPanelSection>
        )}

        {activeSection === 'logs' && (
          <AdminLogsSection
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
            td={td}
          />
        )}

        {activeSection === 'dealers' && (
          <AdminDealersSection
            applications={applications}
            applicationsLoading={applicationsLoading}
            setApplicationsLoaded={setApplicationsLoaded}
            loadApplications={loadApplications}
          />
        )}
      </main>

      <AdminModalsSection
        confirmBan={confirmBan}
      />
    </div>
  );
}
