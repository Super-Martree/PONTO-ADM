const API_URL = import.meta.env.VITE_API_URL;
const TOKEN_KEY = 'authToken';

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
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearAuthToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

export { API_URL, TOKEN_KEY };
