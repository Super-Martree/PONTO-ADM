const API_URL = import.meta.env.VITE_API_URL;
const TOKEN_KEY = 'authToken';

function getStoredValue(key) {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
}

function setStoredValue(key, value) {
  localStorage.setItem(key, value);
  sessionStorage.removeItem(key);
}

function removeStoredValue(key) {
  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

function buildApiUrl(path) {
  if (!API_URL || typeof path !== 'string' || !path.startsWith('/api/')) {
    return path;
  }

  return `${API_URL.replace(/\/$/, '')}${path}`;
}

export function apiFetch(input, init) {
  const options = withAuthHeader(init);

  if (typeof input === 'string') {
    return window.fetch(buildApiUrl(input), options);
  }

  if (input instanceof Request) {
    return window.fetch(new Request(buildApiUrl(input.url), input), options);
  }

  return window.fetch(input, options);
}

function withAuthHeader(init = {}) {
  const token = getAuthToken();

  if (!token) {
    return init;
  }

  const headers = new Headers(init.headers || {});

  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return { ...init, headers };
}

export function getAuthToken() {
  return getStoredValue(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) {
    setStoredValue(TOKEN_KEY, token);
  }
}

export function clearAuthToken() {
  removeStoredValue(TOKEN_KEY);
}

export { API_URL, TOKEN_KEY };
