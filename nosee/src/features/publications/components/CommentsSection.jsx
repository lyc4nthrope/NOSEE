/**
 * CommentsSection.jsx
 *
 * Standalone threaded comments component.
 * Extracted and restyled from PublicationDetailModal.jsx.
 *
 * Props:
 *   publicationId   {string|number}
 *   initialComments {Array}
 *   td              {object} — t.publicationDetail translation dict
 */

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuthStore, selectAuthUser } from "@/features/auth/store/authStore";
import { addComment, deleteComment, getComments } from "@/services/api/publications.api";
import CelebrationOverlay from "@/components/ui/CelebrationOverlay";
import { playSuccessSound } from "@/utils/celebrationSound";
import ReportModal from "@/components/ReportModal";

// ─── Styles ──────────────────────────────────────────────────────────────────

const commentStyles = {
  commentsBox: {
    background: "var(--surface-container, #1c2026)",
    borderRadius: "16px",
    padding: "20px",
    border: "none",
  },

  addCommentForm: {
    marginBottom: "20px",
    background: "var(--surface-container, #1c2026)",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid var(--border, rgba(255,255,255,0.05))",
  },

  commentTextarea: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border, rgba(255,255,255,0.08))",
    background: "var(--bg-elevated, #1a2540)",
    color: "var(--text-primary)",
    fontSize: "14px",
    resize: "vertical",
    boxSizing: "border-box",
    fontFamily: "inherit",
    minHeight: "72px",
    outline: "none",
    transition: "border-color 0.2s",
  },

  submitBtn: {
    padding: "8px 20px",
    borderRadius: "9999px",
    border: "none",
    background: "linear-gradient(135deg, #22b1ec 0%, #1d96c7 100%)",
    color: "#002b3d",
    fontSize: "13px",
    fontWeight: 800,
    cursor: "pointer",
    transition: "opacity 0.15s",
    minHeight: "44px",
  },

  cancelBtn: {
    padding: "8px 16px",
    borderRadius: "9999px",
    border: "1px solid var(--border, rgba(255,255,255,0.08))",
    background: "transparent",
    color: "var(--text-secondary)",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    minHeight: "44px",
  },

  commentCard: {
    background: "var(--surface-container-high, #262a31)",
    borderRadius: "12px",
    padding: "16px",
    margin: "8px 0",
    border: "none",
  },

  commentInner: {
    display: "flex",
    gap: "16px",
  },

  avatarCircle: {
    width: "40px",
    height: "40px",
    borderRadius: "9999px",
    background: "linear-gradient(135deg, #22b1ec, #0ea5e9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: "14px",
    fontWeight: 800,
    color: "#002b3d",
  },

  commentMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "6px",
  },

  commentName: {
    fontWeight: 700,
    fontSize: "13px",
    color: "var(--text-primary)",
  },

  commentTime: {
    fontSize: "10px",
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  commentBody: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
    margin: "0 0 8px",
  },

  commentActions: {
    display: "flex",
    gap: "8px",
    marginTop: "4px",
    flexWrap: "wrap",
  },

  actionBtn: {
    padding: "3px 10px",
    borderRadius: "9999px",
    border: "1px solid var(--border, rgba(255,255,255,0.08))",
    background: "transparent",
    color: "var(--accent, #22b1ec)",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.15s",
    minHeight: "44px",
  },

  actionBtnMuted: {
    padding: "3px 10px",
    borderRadius: "9999px",
    border: "1px solid var(--border-soft, rgba(255,255,255,0.06))",
    background: "transparent",
    color: "var(--text-muted)",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    minHeight: "44px",
  },

  actionBtnDanger: {
    padding: "3px 10px",
    borderRadius: "9999px",
    border: "1px solid rgba(248,113,113,0.2)",
    background: "transparent",
    color: "var(--error, #f87171)",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    minHeight: "44px",
  },

  nestedWrapper: {
    marginLeft: "24px",
    borderLeft: "2px solid var(--border-soft, rgba(121,209,255,0.15))",
    paddingLeft: "16px",
    marginTop: "8px",
  },

  replyFormBox: {
    marginLeft: "20px",
    marginTop: "4px",
    padding: "8px",
    background: "var(--bg-elevated, #1a2540)",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border, rgba(255,255,255,0.06))",
  },
};

// ─── CommentItem ─────────────────────────────────────────────────────────────

function CommentItem({ comment, currentUser, onReply, onDelete, onReport, td, depth }) {
  const isOwn = currentUser && comment.user_id === currentUser.id;
  const userName = comment.user?.full_name || td?.unknownUser || "Usuario";
  const time = comment.created_at
    ? new Date(comment.created_at).toLocaleString("es-CO")
    : "";
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={depth > 0 ? commentStyles.nestedWrapper : {}}>
      <div style={commentStyles.commentCard}>
        <div style={commentStyles.commentInner}>
          <div style={commentStyles.avatarCircle} aria-hidden="true">
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={commentStyles.commentMeta}>
              <span style={commentStyles.commentName}>{userName}</span>
              <span style={commentStyles.commentTime}>{time}</span>
            </div>
            <p style={commentStyles.commentBody}>{comment.content}</p>
            <div style={commentStyles.commentActions}>
              {currentUser && depth < 3 && (
                <button
                  type="button"
                  style={commentStyles.actionBtn}
                  onClick={() => onReply(comment)}
                >
                  {td?.replyBtn ?? "Responder"}
                </button>
              )}
              {currentUser && !isOwn && (
                <button
                  type="button"
                  style={commentStyles.actionBtnMuted}
                  title={td?.reportUser ?? "Reportar usuario"}
                  onClick={() => onReport(comment.user_id, userName)}
                >
                  {td?.reportUser ?? "Reportar"}
                </button>
              )}
              {isOwn && (
                <button
                  type="button"
                  style={commentStyles.actionBtnDanger}
                  onClick={() => onDelete(comment.id)}
                >
                  {td?.deleteComment ?? "Eliminar"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CommentThread ────────────────────────────────────────────────────────────

function CommentThread({
  comment,
  byParent,
  currentUser,
  onReply,
  onDelete,
  onReport,
  td,
  depth = 0,
  replyTo,
  replyText,
  onReplyTextChange,
  onSubmitReply,
  onCancelReply,
  submitting,
  replyInputRef,
}) {
  const replies = byParent[comment.id] || [];
  const isReplyTarget = replyTo?.id === comment.id;

  return (
    <div>
      <CommentItem
        comment={comment}
        currentUser={currentUser}
        onReply={onReply}
        onDelete={onDelete}
        onReport={onReport}
        td={td}
        depth={depth}
      />
      {isReplyTarget && (
        <div style={commentStyles.replyFormBox}>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
            {td?.replyingTo ?? "Respondiendo a"}{" "}
            <strong>{replyTo?.user?.full_name || td?.unknownUser || "Usuario"}</strong>
          </p>
          <textarea
            ref={replyInputRef}
            value={replyText}
            onChange={(e) => onReplyTextChange(e.target.value)}
            placeholder={td?.replyPlaceholder ?? "Escribe tu respuesta..."}
            rows={2}
            maxLength={1000}
            style={commentStyles.commentTextarea}
            disabled={submitting}
          />
          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}
          >
            <button
              type="button"
              style={commentStyles.cancelBtn}
              onClick={onCancelReply}
            >
              {td?.cancelReply ?? "Cancelar"}
            </button>
            <button
              type="button"
              style={commentStyles.submitBtn}
              disabled={submitting || !replyText.trim()}
              onClick={() => onSubmitReply(replyText, replyTo.id)}
            >
              {submitting ? "..." : (td?.addCommentBtn ?? "Comentar")}
            </button>
          </div>
        </div>
      )}
      {replies.map((reply) => (
        <CommentThread
          key={reply.id}
          comment={reply}
          byParent={byParent}
          currentUser={currentUser}
          onReply={onReply}
          onDelete={onDelete}
          onReport={onReport}
          td={td}
          depth={depth + 1}
          replyTo={replyTo}
          replyText={replyText}
          onReplyTextChange={onReplyTextChange}
          onSubmitReply={onSubmitReply}
          onCancelReply={onCancelReply}
          submitting={submitting}
          replyInputRef={replyInputRef}
        />
      ))}
    </div>
  );
}

// ─── CommentsSection ──────────────────────────────────────────────────────────

export default function CommentsSection({ publicationId, initialComments, td }) {
  const { t } = useLanguage();
  const currentUser = useAuthStore(selectAuthUser);

  const [comments, setComments] = useState(initialComments || []);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const replyInputRef = useRef(null);

  // Refresh comments on mount
  useEffect(() => {
    let cancelled = false;
    getComments(publicationId).then((result) => {
      if (!cancelled && result.success) setComments(result.data);
    });
    return () => { cancelled = true; };
  }, [publicationId]);

  // Focus reply input when replyTo changes
  useEffect(() => {
    if (replyTo && replyInputRef.current) {
      replyInputRef.current.focus();
    }
  }, [replyTo]);

  // Build comment tree
  const topLevel = comments.filter((c) => !c.parent_id);
  const byParent = {};
  for (const c of comments) {
    if (c.parent_id) {
      if (!byParent[c.parent_id]) byParent[c.parent_id] = [];
      byParent[c.parent_id].push(c);
    }
  }

  const handleSubmit = async (content, parentId) => {
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await addComment(publicationId, content, parentId);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setComments((prev) => [...prev, result.data]);
    playSuccessSound();
    setShowCelebration(true);
    if (parentId) {
      setReplyTo(null);
      setReplyText("");
    } else {
      setText("");
    }
  };

  const handleDelete = async (commentId) => {
    const result = await deleteComment(commentId);
    if (result.success) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  };

  const handleReply = (comment) => {
    setReplyTo(comment);
    setReplyText("");
  };

  const handleReport = (userId, userName) => {
    setReportTarget({ userId, userName });
  };

  return (
    <div style={commentStyles.commentsBox}>
      {/* Add comment form */}
      {currentUser ? (
        <div style={commentStyles.addCommentForm}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={td?.commentPlaceholder ?? "Escribe un comentario..."}
            rows={2}
            maxLength={1000}
            style={commentStyles.commentTextarea}
            disabled={submitting}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <button
              type="button"
              style={commentStyles.submitBtn}
              disabled={submitting || !text.trim()}
              onClick={() => handleSubmit(text, null)}
            >
              {submitting ? "..." : (td?.addCommentBtn ?? "Comentar")}
            </button>
          </div>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
          {td?.loginToComment ?? "Inicia sesión para comentar."}
        </p>
      )}

      {error && (
        <p style={{ color: "var(--error, #f87171)", fontSize: 13, marginBottom: 8 }}>
          {error}
        </p>
      )}

      {/* Comment list */}
      {comments.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          {td?.noComments ?? "Sin comentarios por ahora."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {topLevel.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              byParent={byParent}
              currentUser={currentUser}
              onReply={handleReply}
              onDelete={handleDelete}
              onReport={handleReport}
              td={td}
              replyTo={replyTo}
              replyText={replyText}
              onReplyTextChange={setReplyText}
              onSubmitReply={handleSubmit}
              onCancelReply={() => setReplyTo(null)}
              submitting={submitting}
              replyInputRef={replyInputRef}
            />
          ))}
        </div>
      )}

      <CelebrationOverlay
        visible={showCelebration}
        message={t.celebration?.comment || "¡Comentario agregado! +1 punto de reputación"}
        onDone={() => setShowCelebration(false)}
      />

      {reportTarget && (
        <ReportModal
          targetType="user"
          targetId={reportTarget.userId}
          targetName={reportTarget.userName}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  );
}
