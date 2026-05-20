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
    throw new ApiError(data.message || '요청에 실패했습니다.', response.status, data);
  }

  return data;
}

export function isUnauthorized(error) {
  return error?.status === 401;
}
