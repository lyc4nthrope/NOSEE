import { useState, useCallback } from 'react';
import { createCategory, getCategories } from '@/services/api/adminCatalog.api';
import { getReputationConfig, updateReputationParam } from '@/services/api/adminConfig.api';
import { useLanguage } from '@/contexts/LanguageContext';
import { DEFAULT_REPUTATION_PARAMS } from '@/features/dashboard/admin/adminConstants';

/**
 * Hook de administración de categorías y configuración de reputación.
 * Expone estado y acciones para gestionar categorías de producto y parámetros de reputación.
 *
 * @returns {{
 *   categories: Array,
 *   catsLoading: boolean,
 *   catsLoaded: boolean,
 *   newCatName: string,
 *   setNewCatName: Function,
 *   savingCat: boolean,
 *   loadCategories: Function,
 *   handleAddCategory: Function,
 *   repParams: Array,
 *   setRepParams: Function,
 *   repParamsLoaded: boolean,
 *   repEditing: boolean,
 *   repDraft: Array,
 *   setRepDraft: Function,
 *   loadReputationConfig: Function,
 *   startEditRep: Function,
 *   cancelEditRep: Function,
 *   saveRep: Function,
 * }}
 */
export default function useAdminCategories() {
  const { t } = useLanguage();
  const td = t.adminDashboard;

  const [categories, setCategories] = useState([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [catsLoaded, setCatsLoaded] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  const [repParams, setRepParams] = useState(DEFAULT_REPUTATION_PARAMS);
  const [repParamsLoaded, setRepParamsLoaded] = useState(false);
  const [repEditing, setRepEditing] = useState(false);
  const [repDraft, setRepDraft] = useState([]);

  const loadCategories = useCallback(async () => {
    setCatsLoading(true);
    try {
      const result = await getCategories();
      if (!result.success) { console.error('[AdminDashboard] loadCategories:', result.error); return; }
      setCategories(result.data || []);
    } finally {
      setCatsLoading(false);
      setCatsLoaded(true);
    }
  }, []);

  const handleAddCategory = useCallback(async (e) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;
    setSavingCat(true);
    try {
      const result = await createCategory(name);
      if (result.success && result.data) {
        setCategories(prev => [...prev, result.data]);
        setNewCatName('');
      } else {
        console.error('[useAdminCategories] createCategory:', result.error);
      }
    } finally {
      setSavingCat(false);
    }
  }, [newCatName, td]);

  const loadReputationConfig = useCallback(async () => {
    const { success, data } = await getReputationConfig();
    if (success && data?.length > 0) {
      setRepParams(data.map(r => ({ id: r.id, param: r.param, value: r.value, note: r.note })));
    }
    setRepParamsLoaded(true);
  }, []);

  const startEditRep = useCallback(() => {
    setRepDraft(repParams.map(p => ({ ...p })));
    setRepEditing(true);
  }, [repParams]);

  const cancelEditRep = useCallback(() => setRepEditing(false), []);

  const saveRep = useCallback(async () => {
    const promises = repDraft.map(async (item) => {
      const original = repParams.find(p => p.param === item.param);
      if (original && original.value !== item.value && original.id) {
        return updateReputationParam(original.id, item.value);
      }
      return { success: true };
    });
    await Promise.all(promises);
    setRepParams(repDraft);
    setRepEditing(false);
  }, [repDraft, repParams]);

  return {
    categories, catsLoading, catsLoaded,
    newCatName, setNewCatName, savingCat,
    loadCategories, handleAddCategory,
    repParams, setRepParams, repParamsLoaded,
    repEditing, repDraft, setRepDraft,
    loadReputationConfig, startEditRep, cancelEditRep, saveRep,
  };
}
