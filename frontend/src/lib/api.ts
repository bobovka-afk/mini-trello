export const API_URL =
  import.meta.env.VITE_API_URL?.toString() || 'http://localhost:3000';

export const RATE_LIMIT_MESSAGE_PREFIX = 'Слишком много попыток.';

export type ApiError = {
  status: number;
  message: string;
  raw?: unknown;
  code?: string;
  isRateLimit?: boolean;
};

function formatRateLimitMessage() {
  return `${RATE_LIMIT_MESSAGE_PREFIX} Подождите немного и повторите действие.`;
}

function extractMessage(data: unknown): string {
  if (typeof data === 'string') return data;
  const payload = data as
    | { message?: unknown; code?: unknown }
    | undefined;
  if (typeof payload?.message === 'string') return payload.message;
  if (Array.isArray(payload?.message)) return payload.message.join(', ');
  if (
    payload?.message &&
    typeof payload.message === 'object' &&
    typeof (payload.message as { message?: unknown }).message === 'string'
  ) {
    return (payload.message as { message: string }).message;
  }
  return JSON.stringify(data);
}

async function readErrorPayload(res: Response): Promise<{ raw: unknown; message: string; code?: string }> {
  try {
    const data = await res.json();
    const payload = data as { code?: unknown };
    return {
      raw: data,
      message: extractMessage(data),
      code: typeof payload?.code === 'string' ? payload.code : undefined,
    };
  } catch {
    try {
      const text = await res.text();
      return { raw: text, message: text };
    } catch {
      const fallback = res.statusText || 'Request failed';
      return { raw: fallback, message: fallback };
    }
  }
}

export function isRateLimitError(e: unknown): boolean {
  const err = e as Partial<ApiError>;
  return Boolean(err?.isRateLimit || err?.status === 429 || err?.code === 'RATE_LIMIT_EXCEEDED');
}

export function formatApiError(e: unknown): string {
  if (isRateLimitError(e)) return formatRateLimitMessage();
  const err = e as Partial<ApiError>;
  if (typeof err?.message === 'string') return err.message;
  return 'Ошибка запроса';
}

export function isRateLimitMessage(message: string | null | undefined): boolean {
  return typeof message === 'string' && message.startsWith(RATE_LIMIT_MESSAGE_PREFIX);
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
    const payload = await readErrorPayload(res);
    const err: ApiError = {
      status: res.status,
      raw: payload.raw,
      code: payload.code,
      isRateLimit: res.status === 429 || payload.code === 'RATE_LIMIT_EXCEEDED',
      message:
        res.status === 429 || payload.code === 'RATE_LIMIT_EXCEEDED'
          ? formatRateLimitMessage()
          : payload.message,
    };
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

