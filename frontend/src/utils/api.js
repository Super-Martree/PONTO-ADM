const API_URL = import.meta.env.VITE_API_URL;

function buildApiUrl(path) {
  if (!API_URL || typeof path !== 'string' || !path.startsWith('/api/')) {
    return path;
  }

  return `${API_URL.replace(/\/$/, '')}${path}`;
}

export function apiFetch(input, init) {
  if (typeof input === 'string') {
    return window.fetch(buildApiUrl(input), init);
  }

  if (input instanceof Request) {
    return window.fetch(new Request(buildApiUrl(input.url), input), init);
  }

  return window.fetch(input, init);
}

export { API_URL };
