export const API_URL =
  import.meta.env.VITE_API_URL?.toString() || 'http://localhost:3000';

export type ApiError = { status: number; message: string; raw?: unknown };

async function readErrorMessage(res: Response) {
  try {
    const data = await res.json();
    if (typeof data?.message === 'string') return data.message;
    if (Array.isArray(data?.message)) return data.message.join(', ');
    return JSON.stringify(data);
  } catch {
    try {
      return await res.text();
    } catch {
      return res.statusText || 'Request failed';
    }
  }
}

export async function api<T>(
  path: string,
  opts: RequestInit & {
    json?: unknown;
    accessToken?: string | null;
  } = {},
): Promise<T> {
  const headers = new Headers(opts.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (opts.json !== undefined) headers.set('Content-Type', 'application/json');
  if (opts.accessToken) headers.set('Authorization', `Bearer ${opts.accessToken}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body,
    credentials: 'include',
  });

  if (!res.ok) {
    const message = await readErrorMessage(res);
    const err: ApiError = { status: res.status, message };
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

