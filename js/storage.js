const STORAGE_KEY = 'yeobo-dinner:v1';

export const DEFAULT_USER_DATA = Object.freeze({
  version: 1,
  preferences: {},
  history: [],
  recentDays: 7,
  onboardingSeen: true
});

function sanitize(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const preferences = {};
  if (data.preferences && typeof data.preferences === 'object') {
    for (const [key, value] of Object.entries(data.preferences)) {
      const score = Number(value);
      if (Number.isFinite(score)) preferences[key] = Math.max(-5, Math.min(8, score));
    }
  }

  const history = Array.isArray(data.history)
    ? data.history
        .filter((item) => item && typeof item.menuId === 'string' && typeof item.selectedAt === 'string')
        .slice(0, 60)
    : [];

  const recentDays = [0, 3, 7, 14].includes(Number(data.recentDays)) ? Number(data.recentDays) : 7;

  return {
    version: 1,
    preferences,
    history,
    recentDays,
    onboardingSeen: Boolean(data.onboardingSeen ?? true)
  };
}

export function loadUserData(storage = window.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_USER_DATA);
    return sanitize(JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_USER_DATA);
  }
}

export function saveUserData(data, storage = window.localStorage) {
  const sanitized = sanitize(data);
  storage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export function recordChoice(data, menuId, answers, selectedAt = new Date().toISOString()) {
  const next = sanitize(data);
  next.history = [
    {
      menuId,
      selectedAt,
      mood: answers.mood ?? null,
      energy: answers.energy ?? null,
      method: answers.method ?? null
    },
    ...next.history
  ].slice(0, 60);
  return next;
}

export function applyFeedback(data, menuId, type) {
  const next = sanitize(data);
  const current = Number(next.preferences[menuId] ?? 0);
  const change = type === 'like' ? 1 : type === 'dislike' ? -1 : 0;
  next.preferences[menuId] = Math.max(-5, Math.min(8, current + change));
  return next;
}

export function updateRecentDays(data, days) {
  const next = sanitize(data);
  next.recentDays = [0, 3, 7, 14].includes(Number(days)) ? Number(days) : 7;
  return next;
}

export function exportUserData(data) {
  return JSON.stringify({
    app: 'yeobo-dinner',
    exportedAt: new Date().toISOString(),
    data: sanitize(data)
  }, null, 2);
}

export function importUserData(text) {
  const parsed = JSON.parse(text);
  const candidate = parsed?.app === 'yeobo-dinner' ? parsed.data : parsed;
  return sanitize(candidate);
}

export function clearUserData(storage = window.localStorage) {
  storage.removeItem(STORAGE_KEY);
  return structuredClone(DEFAULT_USER_DATA);
}
