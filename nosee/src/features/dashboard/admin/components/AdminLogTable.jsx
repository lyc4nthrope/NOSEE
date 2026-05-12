import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { s, ACCENT, BORDER, MUTED, TEXT } from '../adminStyles';
import { LoadingState, EmptyMsg } from './AdminPrimitives';
import {
  getActionLabel as _getActionLabel,
  getObjectInfo as _getObjectInfo,
  getDescription as _getDescription,
  getActionCategory,
} from '../logHelpers';

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const CAT_COLOR = {
  session: 'var(--text-muted)', create: 'var(--success)', edit: ACCENT,
  delete: 'var(--error)', moderate: 'var(--warning)', security: 'var(--error)', other: 'var(--text-muted)',
};

const COLORS = { session: MUTED, activity: ACCENT, admin: 'var(--warning)' };
const COLS = '90px 70px 140px 150px 140px 1fr';

export default function AdminLogTable({
  loginLogs, activityLogs, actionLogs, usersMap, logsLoading,
  logFilter, setLogFilter, logCatFilter, setLogCatFilter,
  logSourceFilter, setLogSourceFilter, logDateFrom, setLogDateFrom, logDateTo, setLogDateTo,
}) {
  const { t } = useLanguage();
  const td = t.adminDashboard;
  const AL = td.logActionLabels || {};

  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ session: 0, activity: 0, admin: 0 });

  useEffect(() => {
    const unifiedRows = [
      ...loginLogs.map(l => ({
        id: `l-${l.id}`, created_at: l.created_at, userId: l.user_id,
        type: l.event_type, details: l.metadata || {}, ip: l.ip_address, ua: l.user_agent,
        source: 'session', reason: null,
      })),
      ...activityLogs.map(a => ({
        id: `a-${a.id}`, created_at: a.created_at, userId: a.user_id,
        type: a.action, details: a.details || {}, ip: null, ua: null,
        source: 'activity', reason: null,
      })),
      ...actionLogs.map(log => ({
        id: `ad-${log.id}`, created_at: log.created_at, userId: log.actor_user_id,
        type: log.action_type, details: { resource_id: log.resource_id, resource_type: log.resource_type, ...(log.metadata || {}) },
        ip: null, ua: null, source: 'admin', reason: log.reason,
      })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map(row => ({
        ...row,
        _fmtDate: fmtDate(row.created_at),
        _titleDate: new Date(row.created_at).toLocaleString('es-CO'),
        _time: new Date(row.created_at).getTime(),
      }));

    setRows(unifiedRows);
    setStats({
      session: unifiedRows.filter(r => r.source === 'session').length,
      activity: unifiedRows.filter(r => r.source === 'activity').length,
      admin: unifiedRows.filter(r => r.source === 'admin').length,
    });
  }, [loginLogs, activityLogs, actionLogs]);

  const [dateBounds, setDateBounds] = useState({ from: null, to: null });

  useEffect(() => {
    setDateBounds({
      from: logDateFrom ? new Date(logDateFrom + 'T00:00:00').getTime() : null,
      to: logDateTo ? new Date(logDateTo + 'T23:59:59').getTime() : null,
    });
  }, [logDateFrom, logDateTo]);

  const visibleRows = useMemo(() => {
    const filterLower = logFilter.trim().toLowerCase();
    const userName = (id) => usersMap[id] || (id ? `${id.slice(0, 8)}…` : '—');

    return rows.filter(row => {
      if (filterLower && !userName(row.userId).toLowerCase().includes(filterLower)) return false;
      if (logCatFilter !== 'all' && getActionCategory(row.type) !== logCatFilter) return false;
      if (logSourceFilter !== 'all' && row.source !== logSourceFilter) return false;
      if (dateBounds.from && row._time < dateBounds.from) return false;
      if (dateBounds.to && row._time > dateBounds.to) return false;
      return true;
    });
  }, [rows, logFilter, logCatFilter, logSourceFilter, dateBounds, usersMap]);

  const hasFilters = logFilter || logCatFilter !== 'all' || logSourceFilter !== 'all' || logDateFrom || logDateTo;

  if (logsLoading) {
    return <LoadingState label={td.logsLoading} />;
  }

  const userName = (id) => usersMap[id] || (id ? `${id.slice(0, 8)}…` : '—');
  const actionLabel = (type) => _getActionLabel(type, AL);
  const objectInfo = (type, d) => _getObjectInfo(type, d);
  const description = (type, d, ip, ua) => _getDescription(type, d, ip, ua);
  const actionColor = (type) => CAT_COLOR[getActionCategory(type)] || 'var(--text-muted)';
  const srcLabels = { session: td.adminLogTable.srcLabelSession, activity: td.adminLogTable.srcLabelActivity, admin: td.adminLogTable.srcLabelAdmin };
  const headers = [td.logsColDate, td.adminLogTable.source, td.logsColUserName, td.logsColActionDone, td.logsColObjectAffected, td.logsColDescriptionDetail];

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <input value={logFilter} onChange={e => setLogFilter(e.target.value)} placeholder={td.adminLogTable.searchUser} style={{ ...s.filterSelect, width: 200, fontFamily: 'inherit' }} />
        <select value={logCatFilter} onChange={e => setLogCatFilter(e.target.value)} style={{ ...s.filterSelect, width: 160 }}>
          <option value="all">{td.adminLogTable.allActions}</option>
          <option value="session">{td.adminLogTable.catSession}</option><option value="create">{td.adminLogTable.catCreate}</option>
          <option value="edit">{td.adminLogTable.catEdit}</option><option value="delete">{td.adminLogTable.catDelete}</option>
          <option value="moderate">{td.adminLogTable.catModerate}</option><option value="security">{td.adminLogTable.catSecurity}</option>
        </select>
        <select value={logSourceFilter} onChange={e => setLogSourceFilter(e.target.value)} style={{ ...s.filterSelect, width: 150 }}>
          <option value="all">{td.adminLogTable.allSources}</option>
          <option value="session">{td.adminLogTable.srcSession}</option><option value="activity">{td.adminLogTable.srcActivity}</option><option value="admin">{td.adminLogTable.srcAdmin}</option>
        </select>
        <input type="date" value={logDateFrom} onChange={e => setLogDateFrom(e.target.value)} title={td.adminLogTable.dateFrom} style={{ ...s.filterSelect, width: 140, fontFamily: 'inherit' }} />
        <input type="date" value={logDateTo} onChange={e => setLogDateTo(e.target.value)} title={td.adminLogTable.dateTo} style={{ ...s.filterSelect, width: 140, fontFamily: 'inherit' }} />
        {hasFilters && (
          <button type="button" onClick={() => { setLogFilter(''); setLogCatFilter('all'); setLogSourceFilter('all'); setLogDateFrom(''); setLogDateTo(''); }}
            style={{ fontSize: 'var(--admin-fs-sm)', color: MUTED, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
            {td.adminLogTable.clearFilters}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 'var(--admin-fs-sm)', color: MUTED }}>
          <strong style={{ color: TEXT }}>{visibleRows.length}</strong> / {rows.length} {td.adminLogTable.records}
        </span>
        <span style={{ fontSize: 'var(--admin-fs-sm)', color: MUTED }}>{td.adminLogTable.labelSession} {stats.session}</span>
        <span style={{ fontSize: 'var(--admin-fs-sm)', color: ACCENT }}>{td.adminLogTable.labelActivity} {stats.activity}</span>
        <span style={{ fontSize: 'var(--admin-fs-sm)', color: 'var(--warning)' }}>{td.adminLogTable.labelAdmin} {stats.admin}</span>
        <span style={{ fontSize: 'var(--admin-fs-sm)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
          <span style={{ color: MUTED }}>{td.adminLogTable.liveLabel}</span>
        </span>
      </div>

      {visibleRows.length === 0 ? (
        <EmptyMsg text={td.logsEmpty} />
      ) : (
        <div style={{ ...s.configCard, overflowX: 'auto', padding: 0 }}>
          <div style={{ minWidth: 780 }} role="grid" aria-label={td.adminLogTable.gridAria}>
            <div style={{ ...s.tableHead, gridTemplateColumns: COLS, position: 'sticky', top: 0, zIndex: 2 }} role="row">
              {headers.map(h => <div key={h} style={s.th} role="columnheader">{h}</div>)}
            </div>
            {visibleRows.map((row, idx) => (
              <div key={row.id} style={{ ...s.tableRow, gridTemplateColumns: COLS, fontSize: 'var(--admin-fs-base)', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-elevated)' }} role="row">
                <div style={{ ...s.td, color: MUTED, fontSize: 'var(--admin-fs-sm)' }} title={row._titleDate}>{row._fmtDate}</div>
                <div style={s.td}>
                  <span style={{ fontSize: 'var(--admin-fs-sm)', fontWeight: 700, padding: '2px 6px', borderRadius: 999, background: `${COLORS[row.source]}18`, color: COLORS[row.source], whiteSpace: 'nowrap' }}>
                    {srcLabels[row.source]}
                  </span>
                </div>
                <div style={{ ...s.td, fontWeight: 700, color: TEXT, fontSize: 'var(--admin-fs-sm)' }}>{userName(row.userId)}</div>
                <div style={{ ...s.td, fontWeight: 600, fontSize: 'var(--admin-fs-sm)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: actionColor(row.type), flexShrink: 0 }} />
                    <span style={{ color: actionColor(row.type) }}>{actionLabel(row.type)}</span>
                  </span>
                </div>
                <div style={{ ...s.td, fontWeight: 500, fontSize: 'var(--admin-fs-sm)' }}>{objectInfo(row.type, row.details)}</div>
                <div style={{ ...s.td, color: MUTED, fontSize: 'var(--admin-fs-sm)' }}>{row.reason || description(row.type, row.details, row.ip, row.ua)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
