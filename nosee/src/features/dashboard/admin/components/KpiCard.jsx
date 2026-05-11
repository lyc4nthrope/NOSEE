import React, { useState } from 'react';
import { s, MUTED, TEXT } from '../adminStyles';

export const KpiCard = React.memo(({ icon, label, value, accentBg, accentColor }) => {
  const [isHovered, setIsHovered] = useState(false);
  const displayValue = value ?? '—';
  const isNumber = typeof value === 'number';

  const cardStyle = {
    ...s.statCard,
    ...(isHovered ? {
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      transform: 'translateY(-1px)',
    } : {}),
  };

  const iconStyle = {
    ...s.statIcon,
    background: accentBg || `${accentColor || 'var(--accent)'}18`,
    color: accentColor || 'var(--accent)',
  };

  const valueStyle = {
    ...s.statValue,
    color: isNumber && value === 0 ? MUTED : TEXT,
  };

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="article"
      aria-label={`${label}: ${displayValue}`}
    >
      <div style={iconStyle} aria-hidden="true">
        {icon}
      </div>
      <div style={valueStyle}>{displayValue}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
});
