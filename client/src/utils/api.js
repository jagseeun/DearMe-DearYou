export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function readJson(response) {
  return response.json().catch(() => ({}));
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await readJson(response);

  if (!response.ok) {
    throw new ApiError(data.message || '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', response.status, data);
  }

  return data;
}

export function isUnauthorized(error) {
  return error?.status === 401;
}
