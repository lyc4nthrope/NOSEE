import { Suspense } from 'react';
import { SectionHeader } from './AdminPrimitives';

export default function AdminPanelSection({ title, sub, _PanelComponent }) {
  return (
    <>
      <SectionHeader title={title} sub={sub} />
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Cargando…</div>}>
        <_PanelComponent />
      </Suspense>
    </>
  );
}
