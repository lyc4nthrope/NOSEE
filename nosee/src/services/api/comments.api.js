import { supabase } from "@/services/supabase.client";
import { detectInappropriateText, detectRestrictedContentText } from "@/services/moderation";
import { createAutoModerationReport } from "@/services/utils/moderationReports";

const hydrateCommentUsers = async (comments) => {
  if (!comments.length) return comments;
  const userIds = [...new Set(comments.map((c) => c.user_id).filter(Boolean))];
  const { data: usersData } = await supabase
    .from("users")
    .select("id, full_name")
    .in("id", userIds);
  const usersMap = {};
  for (const u of usersData || []) usersMap[u.id] = u;
  return comments.map((c) => ({ ...c, user: usersMap[c.user_id] || null }));
};

const COMMENTS_LIMIT = 150;

const loadCommentsRows = async (publicationId) => {
  const baseQuery = supabase
    .from("comments")
    .select("id, content, created_at, user_id, parent_id, is_deleted")
    .eq("publication_id", publicationId)
    .order("created_at", { ascending: true })
    .limit(COMMENTS_LIMIT);

  const withSoftDeleteFilter = await baseQuery.eq("is_deleted", false);
  if (!withSoftDeleteFilter.error) return withSoftDeleteFilter;

  // Compatibilidad: algunos entornos siguen sin la columna is_deleted.
  if (withSoftDeleteFilter.error.code === "42703") {
    const withoutSoftDeleteFilter = await supabase
      .from("comments")
      .select("id, content, created_at, user_id, parent_id")
      .eq("publication_id", publicationId)
      .order("created_at", { ascending: true })
      .limit(COMMENTS_LIMIT);
    return withoutSoftDeleteFilter;
  }

  return withSoftDeleteFilter;
};

export const getComments = async (publicationId) => {
  try {
    if (!publicationId) return { success: false, error: "ID requerido" };

    const { data, error } = await loadCommentsRows(publicationId);
    if (error) return { success: false, error: error.message };
    const rows = (data || []).filter((comment) => comment.is_deleted !== true);
    return { success: true, data: await hydrateCommentUsers(rows) };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const addComment = async (publicationId, content, parentId = null) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Usuario no autenticado" };

    const trimmed = String(content || "").trim();
    if (!trimmed) return { success: false, error: "El comentario no puede estar vacío" };

    const commentModeration = detectInappropriateText(trimmed);
    const restrictedCommentModeration = detectRestrictedContentText(trimmed);
    if (commentModeration.flagged || restrictedCommentModeration.flagged) {
      await createAutoModerationReport({
        reportedType: "user",
        reportedId: user.id,
        reporterUserId: user.id,
        reportedUserId: user.id,
        reason: "offensive",
        description: `AUTO-MODERATION BLOCK (comment): insultos=[${commentModeration.matches.map((m) => m.term).join(", ")}] restringido=[${restrictedCommentModeration.matches.join(", ")}]`,
      });
      return {
        success: false,
        error:
          "Tu comentario fue bloqueado automáticamente por posible contenido ofensivo o adulto/gore.",
        autoModerated: true,
      };
    }

    const { data, error } = await supabase
      .from("comments")
      .insert({
        publication_id: publicationId,
        user_id: user.id,
        content: trimmed,
        parent_id: parentId || null,
      })
      .select("id, content, created_at, user_id, parent_id")
      .single();

    if (error) return { success: false, error: error.message };

    const { data: userData } = await supabase
      .from("users")
      .select("id, full_name")
      .eq("id", user.id)
      .single();

    // Sumar reputación por comentar (best-effort)
    void (async () => {
      await supabase.rpc("increment_user_reputation", {
        target_user_id: user.id,
        reputation_delta: 1,
      });
    })();

    return { success: true, data: { ...data, user: userData || null } };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const deleteComment = async (commentId) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Usuario no autenticado" };

    const { error } = await supabase
      .from("comments")
      .update({ is_deleted: true })
      .eq("id", commentId)
      .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};
