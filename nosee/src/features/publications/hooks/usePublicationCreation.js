import { useState, useEffect } from 'react';
import * as publicationsApi from '@/services/api/publications.api';
import { useGeoLocation } from './useGeoLocation';
import { playSuccessSound } from '@/utils/celebrationSound';
import { useAuthStore } from '@/features/auth/store/authStore';
import { insertUserActivityLog } from '@/services/api/audit.api';
import { recordPublicationCreated, recordPublicationAttempted } from '@/services/metrics';

const initialFormData = {
  productId: '',
  storeId: '',
  price: '',
  currency: 'COP',
  description: '',
  photoUrl: '',
  photoModeration: null,
};

export function usePublicationCreation({ publicationId = null, mode = 'create' } = {}) {
  const { latitude, longitude } = useGeoLocation({ autoFetch: true });

  const [formData, setFormData] = useState(initialFormData);
  const currentUserId = useAuthStore(state => state.user?.id);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(mode === 'edit' && !!publicationId);
  const [showCelebration, setShowCelebration] = useState(false);

  // Cargar publicación si estamos editando
  useEffect(() => {
    if (mode === 'edit' && publicationId) {
      const loadPublication = async () => {
        const result = await publicationsApi.getPublicationDetail(publicationId);
        if (result.success) {
          setFormData({
            productId: String(result.data.product?.id || result.data.productId || ''),
            storeId: result.data.store?.id || result.data.storeId || '',
            price: String(result.data.price || ''),
            currency: result.data.currency || 'COP',
            description: result.data.description || '',
            photoUrl: result.data.photoUrl || '',
            photoModeration: null,
          });
        } else {
          setSubmitError(result.error || 'No se pudo cargar la publicación\nCould not load the publication');
        }
        setIsLoading(false);
      };
      loadPublication();
    }
  }, [publicationId, mode]);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const setPhotoUrl = (url) => {
    updateField('photoUrl', url);
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.productId) {
      newErrors.productId = 'Selecciona o crea un producto\nSelect or create a product';
    }
    if (!formData.storeId) {
      newErrors.storeId = 'Selecciona o crea una tienda\nSelect or create a store';
    }
    if (!formData.price || Number(formData.price) <= 0) {
      newErrors.price = 'El precio debe ser mayor a 0\nPrice must be greater than 0';
    }
    if (!formData.photoUrl && mode === 'create') {
      newErrors.photoUrl = 'La foto es obligatoria\nPhoto is required';
    }
    if (formData.description?.length > 500) {
      newErrors.description = 'Máximo 500 caracteres\nMaximum 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async () => {
    setSubmitError('');
    setSubmitSuccess('');

    if (!validateForm()) {
      return { success: false, error: 'Corrige los errores del formulario\nFix the form errors' };
    }

    setIsSubmitting(true);

    try {
      const payload = {
        productId: Number(formData.productId),
        storeId: formData.storeId,
        price: Number(formData.price),
        photoUrl: formData.photoUrl,
        description: formData.description,
        photoModeration: formData.photoModeration || null,
      };

      if (mode === 'create') {
        recordPublicationAttempted();
      }
      const result = mode === 'create'
        ? await publicationsApi.createPublication(payload)
        : await publicationsApi.updatePublication(publicationId, payload);

      if (!result.success) {
        setSubmitError(result.error || 'Error al procesar la publicación\nError processing the publication');
        return result;
      }

      if (mode === 'create') {
        recordPublicationCreated(!!payload.photoUrl);
      }

      insertUserActivityLog(currentUserId, mode === 'create' ? 'crear_publicacion' : 'editar_publicacion', {
        publicationId: result.data?.id,
        productId: payload.productId,
        storeId: payload.storeId,
      });

      setSubmitSuccess(
        mode === 'create'
          ? 'Publicación creada exitosamente\nPublication created successfully'
          : 'Publicación actualizada exitosamente\nPublication updated successfully'
      );

      // Solo resetear en modo create
      if (mode === 'create') {
        setFormData(initialFormData);
        setShowCelebration(true);
        playSuccessSound();
      }

      return result;
    } catch (error) {
      const errorMsg = error?.message || 'Error inesperado procesando publicación\nUnexpected error processing publication';
      setSubmitError(errorMsg);
      return { success: false, error: errorMsg };
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
    latitude,
    longitude,
    updateField,
    setPhotoUrl,
    submit,
    showCelebration,
    setShowCelebration,
  };
}
