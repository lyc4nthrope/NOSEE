import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/ui/Spinner';
import { s } from '../adminStyles';
import { DealerApplicationsTable } from '../tables/DealerApplicationsTable';

export default function AdminDealersSection({
  applications, applicationsLoading,
  setApplicationsLoaded, loadApplications,
}) {
  return (
    <section style={s.main} className="admin-main">
      <div style={s.section}>
        <div style={s.sectionHead}>
          <span style={s.sectionTitle}><Icon name="Bike" size={20} /> Solicitudes de Repartidor</span>
        </div>
        {applicationsLoading ? (
          <Spinner />
        ) : (
          <DealerApplicationsTable
            applications={applications}
            onReviewed={() => { setApplicationsLoaded(false); loadApplications(); }}
          />
        )}
      </div>
    </section>
  );
}
