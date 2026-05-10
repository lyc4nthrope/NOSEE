import { useState, useEffect, useRef } from 'react';
import * as storesApi from '@/services/api/stores.api';
import { StoreTypeEnum, validateStoreForm } from '@/features/stores/schemas';
import { uploadImageToCloudinary } from '@/services/cloudinary';
import { useAuthStore } from '@/features/auth/store/authStore';
import { insertUserActivityLog } from '@/services/api/audit.api';

const DUPLICATE_RADIUS_METERS = 150;
const STORE_TYPE_ID = {
  [StoreTypeEnum.PHYSICAL]: 1,
  [StoreTypeEnum.VIRTUAL]: 2,
};

const normalizeNameForSignature = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const formatDistanceLabel = (distanceMeters) => {
  const distance = Number(distanceMeters);
  if (!Number.isFinite(distance) || distance < 0) return 'distancia no disponible / distance unavailable';
  if (distance < 1000) return `${Math.round(distance)} m`;
  return `${(distance / 1000).toFixed(1)} km`;
};

const initialFormData = {
  name: '',
  type: StoreTypeEnum.PHYSICAL,
  address: '',
  latitude: null,
  longitude: null,
  websiteUrl: '',
  evidenceFiles: [],
};

export function useStoreCreation({ storeId = null, mode = 'create' } = {}) {
  const [formData, setFormData] = useState(initialFormData);
  const currentUserId = useAuthStore(state => state.user?.id);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(mode === 'edit' && !!storeId);
  const [nearbyStoreMessage, setNearbyStoreMessage] = useState('');
  const lastAutoFillSignatureRef = useRef('');

  // Cargar tienda si estamos editando
  useEffect(() => {
    if (mode === 'edit' && storeId) {
      const loadStore = async () => {
        const result = await storesApi.getStore(storeId);
        if (result.success) {
          const storeData = result.data;
          setFormData({
            name: storeData.name || '',
            type: storeData.type === STORE_TYPE_ID[StoreTypeEnum.PHYSICAL] 
              ? StoreTypeEnum.PHYSICAL 
              : StoreTypeEnum.VIRTUAL,
            address: storeData.address || '',
            latitude: storeData.latitude || null,
            longitude: storeData.longitude || null,
            websiteUrl: storeData.websiteUrl || storeData.website_url || '',
            evidenceFiles: [],
          });
        } else {
          setSubmitError(result.error || 'No se pudo cargar la tienda\nCould not load the store');
        }
        setIsLoading(false);
      };
      loadStore();
    }
  }, [storeId, mode]);

  const updateField = (field, value) => {
    setFormData((prev) => {
      if (field === 'type' && value === StoreTypeEnum.VIRTUAL) {
        // Revocar URLs de preview antes de limpiar evidencias
        prev.evidenceFiles?.forEach((ev) => {
          if (ev?.previewUrl) URL.revokeObjectURL(ev.previewUrl);
        });
        return {
          ...prev,
          type: value,
          address: '',
          latitude: null,
          longitude: null,
          evidenceFiles: [],
        };
      }

      return { ...prev, [field]: value };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      if (field === 'latitude' || field === 'longitude') delete next.location;
      if (field === 'name') delete next.name;
      return next;
    });
  };

  const setLocation = ({ latitude, longitude, address }) => {
    setFormData((prev) => ({
      ...prev,
      latitude,
      longitude,
      address: address ?? prev.address,
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.location;
      return next;
    });
  };

  const addEvidenceFile = (file) => {
    if (!file) return;
    const evidence = {
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    };
    setFormData((prev) => {
     if (prev.evidenceFiles.length >= 3) return prev;
      return { ...prev, evidenceFiles: [...prev.evidenceFiles, evidence] };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.evidenceUrls;
      return next;
    });
  };

  const removeEvidenceFile = (evidenceId) => {
    setFormData((prev) => {
      const target = prev.evidenceFiles.find((item) => item.id === evidenceId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return { ...prev, evidenceFiles: prev.evidenceFiles.filter((item) => item.id !== evidenceId) };
    });
  };

  const checkNearbyDuplicates = async () => {
    // En modo edición, no validar duplicados (la tienda ya existe)
    if (mode === 'edit') {
      return { success: true };
    }

    if (formData.type !== StoreTypeEnum.PHYSICAL) {
      return { success: true };
    }

    const result = await storesApi.searchNearbyStores(
      formData.name,
      Number(formData.latitude),
      Number(formData.longitude),
      DUPLICATE_RADIUS_METERS
    );

    if (!result.success) {
      return { success: false, error: result.error || 'No se pudo validar duplicados cercanos\nCould not validate nearby duplicates' };
    }

    const candidates = (result.data || []).filter(
      (store) => String(store.name || '').trim().toLowerCase() === String(formData.name || '').trim().toLowerCase()
    );

    if (candidates.length > 0) {
      const nearest = candidates[0];
      return {
        success: false,
        error: `Posible duplicado: ya existe "${nearest.name}" cerca de esta ubicación.\nPossible duplicate: "${nearest.name}" already exists near this location.`,
      };
    }

    return { success: true };
  };

  useEffect(() => {
    if (mode !== 'create') return;
    if (formData.type !== StoreTypeEnum.PHYSICAL) {
      setNearbyStoreMessage('');
      return;
    }

    const lat = Number(formData.latitude);
    const lon = Number(formData.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setNearbyStoreMessage('');
      return;
    }

    let cancelled = false;
    setNearbyStoreMessage('Detectando tienda cercana...\nDetecting nearby store...');

    const timer = setTimeout(async () => {
      const mapPlaceResult = await storesApi.detectMapPlaceAtLocation(lat, lon);
      if (cancelled) return;

      if (mapPlaceResult.success && mapPlaceResult.data?.placeName) {
        const mapName = mapPlaceResult.data.placeName;
        const mapAddress = mapPlaceResult.data.address || '';
        const mapSearchResult = await storesApi.searchNearbyStores(mapName, lat, lon, 500);
        if (cancelled) return;

        if (mapSearchResult.success) {
          const mapMatch = (mapSearchResult.data || [])
            .filter((store) => store.type === StoreTypeEnum.PHYSICAL || store.type === 'physical')
            .sort((a, b) => (Number(a.distanceMeters) || 1e12) - (Number(b.distanceMeters) || 1e12))[0];

          if (mapMatch) {
            const mapLat = Number(mapMatch.latitude);
            const mapLon = Number(mapMatch.longitude);
            const hasCoords = Number.isFinite(mapLat) && Number.isFinite(mapLon);
            const signature = `map:${mapMatch.id}`;

            if (lastAutoFillSignatureRef.current === signature) {
              return;
            }

            if (lastAutoFillSignatureRef.current !== signature) {
              setFormData((prev) => ({
                ...prev,
                name: mapMatch.name || mapName || prev.name,
                address: mapAddress || mapMatch.address || prev.address || '',
                latitude: hasCoords ? mapLat : prev.latitude,
                longitude: hasCoords ? mapLon : prev.longitude,
              }));
              lastAutoFillSignatureRef.current = signature;
            }

            const distance = formatDistanceLabel(mapMatch.distanceMeters);
            setNearbyStoreMessage(`Tienda detectada por mapa, distancia de la ubicación actual: "${mapMatch.name}" a ${distance}. Nombre, dirección y ubicación autocompletados.\nStore detected by map, distance from current location: "${mapMatch.name}" at ${distance}. Name, address and location auto-filled.`);
            return;
          }
        }

        const fallbackSignature = `map-name:${normalizeNameForSignature(mapName)}:${lat.toFixed(5)}:${lon.toFixed(5)}`;
        if (lastAutoFillSignatureRef.current !== fallbackSignature) {
          setFormData((prev) => ({
            ...prev,
            name: mapName || prev.name,
            address: mapAddress || prev.address || '',
          }));
          lastAutoFillSignatureRef.current = fallbackSignature;
        }
        setNearbyStoreMessage(`Lugar detectado en mapa: ${mapName}. Nombre y dirección autocompletados.\nPlace detected on map: ${mapName}. Name and address auto-filled.`);
        return;
      }

      const nearestResult = await storesApi.findNearestPhysicalStore(lat, lon, {
        maxCandidates: 1500,
        batchSize: 250,
      });
      if (cancelled) return;

      if (!nearestResult.success) {
        setNearbyStoreMessage('No se pudo detectar tienda cercana automáticamente.\nCould not automatically detect a nearby store.');
        return;
      }

      const nearest = nearestResult.data;
      if (!nearest) {
        setNearbyStoreMessage('No encontramos tiendas físicas cercanas.\nNo nearby physical stores found.');
        return;
      }

      const distance = formatDistanceLabel(nearest.distanceMeters);

      const signature = `nearest:${nearest.id}`;
      if (lastAutoFillSignatureRef.current === signature) {
        return;
      }

      if (lastAutoFillSignatureRef.current !== signature) {
        const nearestLat = Number(nearest.latitude);
        const nearestLon = Number(nearest.longitude);
        const hasNearestCoords = Number.isFinite(nearestLat) && Number.isFinite(nearestLon);

        setFormData((prev) => ({
          ...prev,
          // Autocompleta nombre y dirección con la tienda detectada.
          name: nearest.name || prev.name,
          address: nearest.address || prev.address || '',
          // También autocompleta ubicación del local para mover el marcador del mapa.
          latitude: hasNearestCoords ? nearestLat : prev.latitude,
          longitude: hasNearestCoords ? nearestLon : prev.longitude,
        }));
        lastAutoFillSignatureRef.current = signature;
      }

      setNearbyStoreMessage(`Tienda detectada por base de datos, distancia de la ubicación actual: "${nearest.name}" a ${distance}. Nombre, dirección y ubicación autocompletados.\nStore detected in database, distance from current location: "${nearest.name}" at ${distance}. Name, address and location auto-filled.`);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.latitude, formData.longitude, formData.type, mode]);

  const submit = async () => {
    setSubmitError('');
    setSubmitSuccess('');

    const { isValid, errors: validationErrors } = validateStoreForm(formData);
    if (!isValid) {
      setErrors(validationErrors);
      return { success: false, error: 'Corrige los errores del formulario\nFix the form errors' };
    }

    setIsSubmitting(true);

    try {
      const duplicateCheck = await checkNearbyDuplicates();
      if (!duplicateCheck.success) {
        setSubmitError(duplicateCheck.error);
        return duplicateCheck;
      }

      const payload = {
        ...formData,
        type: STORE_TYPE_ID[formData.type],
      };

      // Diferenciar entre create y update
      const result = mode === 'create'
        ? await storesApi.createStore(payload)
        : await storesApi.updateStore(storeId, payload);

      if (!result.success) {
        const action = mode === 'create' ? 'crear' : 'actualizar';
        const actionEn = mode === 'create' ? 'create' : 'update';
        setSubmitError(result.error || `No se pudo ${action} la tienda\nCould not ${actionEn} the store`);
        return result;
      }

      insertUserActivityLog(currentUserId, mode === 'create' ? 'crear_tienda' : 'editar_tienda', {
        storeId: result.data?.store?.id || result.data?.id,
        storeName: formData.name,
      });

      // Manejar evidencias solo en modo create/physical
      const resultStoreId = result?.data?.store?.id || result?.data?.id;
      const evidenceUploadErrors = [];

      if (mode === 'create' && resultStoreId && formData.type === StoreTypeEnum.PHYSICAL && formData.evidenceFiles.length > 0) {
        for (const evidence of formData.evidenceFiles) {
          const uploadResult = await uploadImageToCloudinary(evidence.file, {
            folder: 'nosee/stores/evidence',
          });

          if (!uploadResult.success) {
            evidenceUploadErrors.push(uploadResult.error || 'No se pudo subir una evidencia\nCould not upload evidence');
            continue;
          }

          const evidenceResult = await storesApi.uploadStoreEvidence(
            resultStoreId,
            uploadResult.optimizedUrl || uploadResult.url
          );
          if (!evidenceResult.success) {
            evidenceUploadErrors.push(evidenceResult.error || 'No se pudo guardar una evidencia\nCould not save evidence');
          }
        }
      }

      if (evidenceUploadErrors.length > 0) {
        const action = mode === 'create' ? 'creada' : 'actualizada';
        setSubmitSuccess(`Tienda ${action}, pero algunas evidencias no se pudieron registrar.\nStore ${action === 'creada' ? 'created' : 'updated'}, but some evidence could not be saved.`);
        setSubmitError(evidenceUploadErrors[0]);
      } else {
        const action = mode === 'create' ? 'creada' : 'actualizada';
        setSubmitSuccess(`Tienda ${action} exitosamente\nStore ${action === 'creada' ? 'created' : 'updated'} successfully`);
      }

      // Solo resetear en modo create — revocar previews antes de limpiar
      if (mode === 'create') {
        setFormData((prev) => {
          prev.evidenceFiles?.forEach((ev) => {
            if (ev?.previewUrl) URL.revokeObjectURL(ev.previewUrl);
          });
          return initialFormData;
        });
      }

      setErrors({});
      return result;
    } catch (error) {
      const fallbackMessage = `Error inesperado ${mode === 'create' ? 'creando' : 'actualizando'} tienda\nUnexpected error ${mode === 'create' ? 'creating' : 'updating'} store`;
      setSubmitError(error?.message || fallbackMessage);
      return { success: false, error: error?.message || fallbackMessage };
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    formData,
    errors,
    isSubmitting,
    submitError,
    submitSuccess,
    isLoading,
    nearbyStoreMessage,
    updateField,
    setLocation,
    addEvidenceFile,
    removeEvidenceFile,
    submit,
    clearMessages: () => {
      setSubmitError('');
      setSubmitSuccess('');
    },
  };
}

export default useStoreCreation;
