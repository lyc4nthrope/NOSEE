import React from 'react';
import { s, MUTED, TEXT } from '../adminStyles';

export const KpiCard = React.memo(({ icon, label, value }) => {
  const displayValue = value ?? '—';
  const isNumber = typeof value === 'number';

  return (
    <div style={s.statCard}>
      <div style={s.statTop}>
        <span aria-hidden="true" style={s.statIcon}>{icon}</span>
      </div>
      <div style={{
        ...s.statValue,
        color: isNumber && value === 0 ? MUTED : TEXT,
      }}>
        {displayValue}
      </div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
});
