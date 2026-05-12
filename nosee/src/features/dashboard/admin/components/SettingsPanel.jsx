/**
 * SettingsPanel.jsx
 *
 * Panel de configuración del sistema.
 * Reemplaza la edición inline en AdminDashboard y usa adminConfig.api.js.
 *
 * UBICACIÓN: src/features/dashboard/admin/components/SettingsPanel.jsx
 */
import { useState, useEffect } from 'react';
import { getReputationConfig, updateReputationParam, getCategories, insertCategory } from '@/services/api/adminConfig.api';
import { useLanguage } from '@/contexts/LanguageContext';
import { s, ACCENT, MUTED, TEXT, BORDER } from '../adminStyles';

export default function SettingsPanel() {
  const { t } = useLanguage();
  const td = t.adminDashboard;

  // Reputation params
  const [repParams, setRepParams] = useState([]);
  const [repDraft, setRepDraft] = useState([]);
  const [repEditing, setRepEditing] = useState(false);
  const [repLoading, setRepLoading] = useState(true);
  const [repSaving, setRepSaving] = useState(false);
  const [repError, setRepError] = useState(null);

  // Categories
  const [categories, setCategories] = useState([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [newCatName, setNewCatName] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setRepLoading(true);
      setRepError(null);
      setCatsLoading(true);

      const [configResult, categoriesResult] = await Promise.all([
        getReputationConfig(),
        getCategories(),
      ]);

      if (!isMounted) return;

      if (configResult.success) {
        setRepParams(configResult.data || []);
      } else {
        setRepError(configResult.error);
      }
      setRepLoading(false);

      if (!categoriesResult.success) {
        console.error('[SettingsPanel] loadCategories:', categoriesResult.error);
      }
      setCategories(categoriesResult.data || []);
      setCatsLoading(false);
    }

    loadData();
    return () => { isMounted = false; };
  }, []);

  const startEditRep = () => {
    setRepDraft(repParams.map(p => ({ ...p })));
    setRepEditing(true);
  };

  const cancelEditRep = () => setRepEditing(false);

  const saveRep = async () => {
    setRepSaving(true);
    const promises = repDraft.map(async (item) => {
      const original = repParams.find(p => p.id === item.id);
      if (original && original.value !== item.value) {
        return updateReputationParam(item.id, item.value);
      }
      return { success: true };
    });
    await Promise.all(promises);
    setRepParams(repDraft);
    setRepEditing(false);
    setRepSaving(false);
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    setSavingCat(true);
    const result = await insertCategory(name);
    if (result.success) {
      setCategories(prev => [...prev, result.data]);
      setNewCatName('');
    } else {
      console.error('[SettingsPanel] createCategory:', result.error);
    }
    setSavingCat(false);
  };

  return (
    <section aria-label={td.settingsPanel.sectionAria} role="region">
      {/* ── Parámetros de reputación ──────────────────────────── */}
      <section aria-label={td.settingsPanel.repAria} style={s.section}>
        <div style={s.sectionHead}>
          <span style={s.sectionTitle}>{td.repTitle}</span>
          {repLoading ? null : repEditing ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={cancelEditRep} style={s.btnDismiss} disabled={repSaving}>
                {td.cancel}
              </button>
              <button onClick={saveRep} style={{ ...s.filterBtn, ...s.filterBtnActive }} disabled={repSaving}>
                {repSaving ? td.settingsPanel.savingLabel : td.save}
              </button>
            </div>
          ) : (
            <button onClick={startEditRep} style={s.filterBtn}>{td.editBtn}</button>
          )}
        </div>

        {repLoading ? (
          <div style={{ textAlign: 'center', padding: 24, color: MUTED }}>{td.loadingDots}</div>
        ) : repError ? (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--error)' }}>{repError}</div>
        ) : (
          <div style={s.configCard}>
            {(repEditing ? repDraft : repParams).map((item, i) => (
              <div key={item.id} style={s.configRow}>
                <div>
                  <div style={s.configParam}>{item.param}</div>
                  <div style={s.configNote}>{item.note}</div>
                </div>
                {repEditing ? (
                  <input
                    type="text"
                    value={repDraft[i]?.value || ''}
                    onChange={e => {
                      const next = [...repDraft];
                      next[i] = { ...next[i], value: e.target.value };
                      setRepDraft(next);
                    }}
                    style={{
                      background: 'var(--bg-elevated)', border: `1px solid ${BORDER}`,
                      color: TEXT, borderRadius: 6, padding: '5px 10px',
                      fontSize: 'var(--admin-fs-md)', fontWeight: 700, width: 80, textAlign: 'right',
                    }}
                  />
                ) : (
                  <span style={{
                    ...s.configValue,
                    color: item.value.startsWith('+') ? 'var(--success)'
                         : item.value.startsWith('-') ? 'var(--error)' : ACCENT,
                  }}>
                    {item.value}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Categorías de productos ───────────────────────────── */}
      <section aria-label={td.settingsPanel.catsAria} style={s.section}>
        <div style={s.sectionHead}>
          <span style={s.sectionTitle}>{td.catsTitle}</span>
          {catsLoading
            ? null
            : <span style={{ fontSize: 'var(--admin-fs-base)', color: MUTED }}>{categories.length} {td.settingsPanel.categoriesLabel}</span>
          }
        </div>

        <form onSubmit={handleAddCategory} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <input
            type="text"
            placeholder={td.newCatPlaceholder}
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
              style={{
                flex: 1, background: 'var(--bg-elevated)', border: `1px solid ${BORDER}`,
                color: TEXT, borderRadius: 8, padding: '8px 14px', fontSize: 'var(--admin-fs-md)',
              }}
          />
          <button
            type="submit"
            disabled={savingCat || !newCatName.trim()}
            style={{ ...s.filterBtn, ...s.filterBtnActive, opacity: savingCat || !newCatName.trim() ? 0.5 : 1 }}
          >
            {savingCat ? td.settingsPanel.creatingLabel : td.createBtn}
          </button>
        </form>

        {catsLoading ? (
          <div style={{ textAlign: 'center', padding: 24, color: MUTED }}>{td.loadingDots}</div>
        ) : categories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: MUTED }}>{td.settingsPanel.noCategories}</div>
        ) : (
          <div style={s.configCard}>
            {categories.map(cat => (
              <div key={cat.id} style={s.configRow}>
                <div style={s.configParam}>{cat.name}</div>
                <span style={{ ...s.configValue, color: MUTED, fontSize: 'var(--admin-fs-base)' }}>
                  {cat.products?.[0]?.count ?? 0} {td.settingsPanel.productsLabel}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
