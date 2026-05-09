/**
 * usePublicationMutations.js
 *
 * Hook de mutaciones para publicaciones (upvote / downvote / unvote / report)
 * con lógica de actualización optimista y rollback en caso de error.
 *
 * UBICACIÓN: src/features/publications/hooks/usePublicationMutations.js
 *
 * @param {Object} params
 * @param {Function} params.setPublications - Setter del estado de publicaciones en usePublications
 */

import { useCallback } from 'react';
import * as publicationsApi from '@/services/api/publications.api';
import { debugPublications } from '@/utils/debugLogger';

export const usePublicationMutations = ({ setPublications }) => {
  /**
   * Validar (upvote) una publicación
   * Optimistic: incrementa validated_count y fija user_vote = 1 antes de la llamada API.
   * Rollback: restaura el estado previo si la API falla.
   */
  const validatePublication = useCallback(async (publicationId) => {
    let prevState = null;
    setPublications((prev) => {
      const pub = prev.find((p) => p.id === publicationId);
      if (pub) prevState = { validated_count: pub.validated_count, user_vote: pub.user_vote };
      return prev.map((p) =>
        p.id === publicationId
          ? { ...p, validated_count: (p.validated_count || 0) + 1, user_vote: 1 }
          : p
      );
    });

    try {
      const result = await publicationsApi.validatePublication(publicationId);
      if (!result.success && prevState !== null) {
        setPublications((prev) =>
          prev.map((p) => (p.id === publicationId ? { ...p, ...prevState } : p))
        );
      }
      return result;
    } catch (err) {
      if (prevState !== null) {
        setPublications((prev) =>
          prev.map((p) => (p.id === publicationId ? { ...p, ...prevState } : p))
        );
      }
      debugPublications('mutation:validate:error', { publicationId, error: err?.message });
      return { success: false, error: err.message };
    }
  }, [setPublications]);

  /**
   * Quitar validación (unvote) de una publicación
   * Optimistic: decrementa el contador del voto activo y limpia user_vote.
   * Rollback: restaura validated_count, downvoted_count y user_vote si falla.
   */
  const unvotePublication = useCallback(async (publicationId) => {
    let prevState = null;
    setPublications((prev) => {
      const pub = prev.find((p) => p.id === publicationId);
      if (pub) prevState = { validated_count: pub.validated_count, downvoted_count: pub.downvoted_count, user_vote: pub.user_vote };
      return prev.map((p) => {
        if (p.id !== publicationId) return p;
        return {
          ...p,
          validated_count: p.user_vote === 1 ? Math.max((p.validated_count || 1) - 1, 0) : p.validated_count,
          downvoted_count: p.user_vote === -1 ? Math.max((p.downvoted_count || 1) - 1, 0) : p.downvoted_count,
          user_vote: null,
        };
      });
    });

    try {
      const result = await publicationsApi.unvotePublication(publicationId);
      if (!result.success && prevState !== null) {
        setPublications((prev) =>
          prev.map((p) => (p.id === publicationId ? { ...p, ...prevState } : p))
        );
      }
      return result;
    } catch (err) {
      if (prevState !== null) {
        setPublications((prev) =>
          prev.map((p) => (p.id === publicationId ? { ...p, ...prevState } : p))
        );
      }
      debugPublications('mutation:unvote:error', { publicationId, error: err?.message });
      return { success: false, error: err.message };
    }
  }, [setPublications]);

  /**
   * Downvote una publicación
   * Optimistic: incrementa downvoted_count y fija user_vote = -1.
   * Rollback: restaura downvoted_count y user_vote si la API falla.
   */
  const downvotePublication = useCallback(async (publicationId) => {
    let prevState = null;
    setPublications((prev) => {
      const pub = prev.find((p) => p.id === publicationId);
      if (pub) prevState = { downvoted_count: pub.downvoted_count, user_vote: pub.user_vote };
      return prev.map((p) =>
        p.id === publicationId
          ? { ...p, downvoted_count: (p.downvoted_count || 0) + 1, user_vote: -1 }
          : p
      );
    });

    try {
      const result = await publicationsApi.downvotePublication(publicationId);
      if (!result.success && prevState !== null) {
        setPublications((prev) =>
          prev.map((p) => (p.id === publicationId ? { ...p, ...prevState } : p))
        );
      }
      return result;
    } catch (err) {
      if (prevState !== null) {
        setPublications((prev) =>
          prev.map((p) => (p.id === publicationId ? { ...p, ...prevState } : p))
        );
      }
      debugPublications('mutation:downvote:error', { publicationId, error: err?.message });
      return { success: false, error: err.message };
    }
  }, [setPublications]);

  /**
   * Reportar una publicación
   * No optimista: espera resultado de la API para incrementar reported_count.
   *
   * @param {number} publicationId   - ID de la publicación
   * @param {object} reportPayload   - { reason, description, evidenceFile }
   */
  const reportPublication = useCallback(
    async (publicationId, reportPayload) => {
      try {
        const result = await publicationsApi.reportPublication(
          publicationId,
          reportPayload
        );

        if (result.success) {
          setPublications((prev) =>
            prev.map((pub) =>
              pub.id === publicationId
                ? { ...pub, reported_count: (pub.reported_count || 0) + 1 }
                : pub
            )
          );
          return result;
        } else {
          return result;
        }
      } catch (err) {
        debugPublications('mutation:report:error', { publicationId, error: err?.message });
        return {
          success: false,
          error: err.message,
          message: 'Error al reportar la publicación',
        };
      }
    },
    [setPublications]
  );

  return {
    validatePublication,
    downvotePublication,
    unvotePublication,
    reportPublication,
  };
};

export default usePublicationMutations;
