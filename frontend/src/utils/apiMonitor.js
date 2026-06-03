const API_ACTIVITY_EVENT = 'ponto:api-activity';

let installed = false;
let activeRequests = 0;
let currentOperation = 'consulta';

function isApiRequest(input) {
  const url = typeof input === 'string' ? input : input?.url;
  if (!url) return false;

  try {
    const parsedUrl = new URL(url, window.location.origin);
    return parsedUrl.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

function getOperation(input, init) {
  const method = (init?.method || input?.method || 'GET').toUpperCase();
  return method === 'GET' || method === 'HEAD' ? 'consulta' : 'atualizacao';
}

function getLoadingTitle(operation) {
  return operation === 'consulta' ? 'Consultando banco de dados' : 'Atualizando banco de dados';
}

function getFallbackErrorMessage(operation) {
  if (operation === 'consulta') {
    return 'Nao foi possivel consultar os dados agora. Verifique se o SQL Server esta online e tente novamente.';
  }

  return 'Nao foi possivel gravar a alteracao agora. Verifique se o SQL Server esta online e tente novamente.';
}

function dispatchActivity(detail = {}) {
  window.dispatchEvent(new CustomEvent(API_ACTIVITY_EVENT, {
    detail: {
      loading: activeRequests > 0,
      title: getLoadingTitle(currentOperation),
      operation: currentOperation,
      ...detail,
    },
  }));
}

async function readErrorPayload(response) {
  try {
    return await response.clone().json();
  } catch {
    return null;
  }
}

function dispatchConnectionError(operation, message) {
  dispatchActivity({
    error: {
      title: 'Sem conexao com o banco de dados',
      message: message || getFallbackErrorMessage(operation),
    },
  });
}

export function installApiMonitor() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    if (!isApiRequest(input)) {
      return originalFetch(input, init);
    }

    const operation = getOperation(input, init);
    activeRequests += 1;
    currentOperation = operation;
    dispatchActivity();

    try {
      const response = await originalFetch(input, init);

      if (!response.ok && response.status >= 500) {
        const payload = await readErrorPayload(response);
        if (response.status === 503 || payload?.code === 'DB_CONNECTION_ERROR') {
          dispatchConnectionError(operation, payload?.message);
        }
      }

      return response;
    } catch (error) {
      dispatchConnectionError(operation);
      throw error;
    } finally {
      activeRequests = Math.max(0, activeRequests - 1);
      dispatchActivity();
    }
  };
}

export { API_ACTIVITY_EVENT };
