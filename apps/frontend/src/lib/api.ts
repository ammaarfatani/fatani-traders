export class ApiError extends Error {
  statusCode: number;
  errors?: any[];
  constructor(message: string, statusCode: number = 400, errors?: any[]) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}, unwrapData = true): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const token = typeof window !== 'undefined' ? localStorage.getItem('fatani_auth_token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMsg = (typeof data === 'object' && data.message) || response.statusText || 'Request failed';
    const errorDetails = typeof data === 'object' ? data.errors : undefined;
    throw new ApiError(errorMsg, response.status, errorDetails);
  }

  return (unwrapData && typeof data === 'object' && 'data' in data ? data.data : data) as T;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) => request<T>(endpoint, { method: 'GET', ...options }),
  getEnvelope: <T>(endpoint: string, options?: RequestInit) => request<T>(endpoint, { method: 'GET', ...options }, false),
  post: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined, ...options }),
  put: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, ...options }),
  patch: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, ...options }),
  delete: <T>(endpoint: string, options?: RequestInit) => request<T>(endpoint, { method: 'DELETE', ...options }),
};
