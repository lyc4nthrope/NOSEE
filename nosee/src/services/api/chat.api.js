/**
 * chat.api.js
 *
 * API para comunicarse con el webhook de n8n que procesa los mensajes del chat.
 *
 * FLUJO:
 * 1. Usuario envía mensaje desde el ChatWidget
 * 2. Esta función llama al webhook de n8n
 * 3. n8n procesa el mensaje con OpenRouter
 * 4. Devuelve la respuesta del asistente
 *
 * UBICACIÓN: src/services/api/chat.api.js
 */

// ─── Configuración ──────────────────────────────────────────────────────────
// TODO: Reemplazar con la URL real del webhook de n8n
// Ejemplo: 'https://tu-n8n.com/webhook/chat'
const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_CHAT_WEBHOOK_URL || '';
const TIMEOUT_MS = 60000; // 60 segundos

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Envía un mensaje al webhook de n8n y espera la respuesta del asistente.
 */
export async function sendChatMessage({ message, sessionId, userId }) {
  if (!N8N_WEBHOOK_URL) {
    return {
      success: false,
      error: 'Webhook de n8n no configurado. Revisa la variable VITE_N8N_CHAT_WEBHOOK_URL',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId, userId }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `Error del servidor: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();

    if (!data.reply) {
      return {
        success: false,
        error: 'Respuesta inválida del servidor',
      };
    }

    return { success: true, reply: data.reply };
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Tiempo de espera agotado. Intentalo de nuevo.',
      };
    }
    return {
      success: false,
      error: error?.message || 'Error de conexión. Verificá tu internet.',
    };
  }
}
