export function getAuthHeader(token: string | null): Record<string, string> {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function createApiClient(baseUrl: string, token: string | null) {
  return {
    async get(endpoint: string) {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(token),
        },
      });

      const data = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error((data.error as string) || `HTTP error ${response.status}`);
      }
      return data;
    },

    async post(endpoint: string, body: Record<string, unknown> = {}) {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(token),
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as Record<string, unknown>;
      if (!response.ok) {
        const err = new Error((data.error as string) || `HTTP error ${response.status}`) as Error & { status?: number };
        err.status = response.status;
        throw err;
      }
      return data;
    },
  };
}
