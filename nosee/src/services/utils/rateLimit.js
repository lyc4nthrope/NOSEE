const actionCounts = new Map();
const WINDOW_MS = 60000;
const MAX_ACTIONS = 30;

export function checkRateLimit(actionType) {
  const now = Date.now();
  const key = `${actionType}`;

  if (!actionCounts.has(key)) {
    actionCounts.set(key, []);
  }

  const timestamps = actionCounts.get(key);
  const recent = timestamps.filter(t => now - t < WINDOW_MS);

  if (recent.length >= MAX_ACTIONS) {
    return { allowed: false, retryAfter: Math.ceil((recent[0] + WINDOW_MS - now) / 1000) };
  }

  recent.push(now);
  actionCounts.set(key, recent);
  return { allowed: true };
}
