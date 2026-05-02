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

const API_ERROR_CODE_RU: Record<string, string> = {
  EMAIL_ALREADY_EXISTS: 'Пользователь с таким email уже существует.',
  INVALID_REFRESH_TOKEN: 'Сессия истекла. Войдите снова.',
  REFRESH_TOKEN_REQUIRED: 'Сессия недействительна. Войдите снова.',
  TOKEN_REQUIRED: 'Отсутствует токен подтверждения.',
  TOKEN_INVALID_OR_EXPIRED: 'Ссылка недействительна или истекла.',
  PASSWORD_REQUIRED: 'Введите пароль.',
  NEW_PASSWORD_REQUIRED: 'Введите новый пароль.',
  CURRENT_PASSWORD_REQUIRED: 'Введите текущий пароль.',
  PASSWORD_SHOULD_DIFFER: 'Новый пароль должен отличаться от текущего.',
  INVALID_CURRENT_PASSWORD: 'Текущий пароль указан неверно.',
  INVALID_CREDENTIALS: 'Неверный email или пароль.',
  USER_NOT_FOUND: 'Пользователь не найден.',
  UNAUTHORIZED: 'Требуется авторизация.',
  WORKSPACE_ACTION_FORBIDDEN: 'Недостаточно прав для этого действия.',
  USER_ALREADY_MEMBER: 'Пользователь уже состоит в рабочем пространстве.',
  INVITE_ALREADY_SENT: 'Приглашение уже отправлено.',
  INVITE_NOT_FOUND: 'Приглашение не найдено.',
  INVITE_ACCESS_DENIED: 'Нет доступа к этому приглашению.',
  INVITE_ALREADY_PROCESSED: 'Приглашение уже обработано.',
  INVITE_EXPIRED: 'Срок действия приглашения истёк.',
  INVITE_MAIL_FAILED:
    'Не удалось отправить письмо с приглашением. Проверьте настройки почты и попробуйте снова.',
  RATE_LIMIT_EXCEEDED: `${RATE_LIMIT_MESSAGE_PREFIX} Подождите немного и повторите действие.`,
};

function translateCommonEnglishError(message: string): string | null {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.includes('current password is invalid')) {
    return 'Текущий пароль указан неверно.';
  }
  if (normalized.includes('current password is required')) {
    return 'Введите текущий пароль.';
  }
  if (normalized.includes('new password must be different')) {
    return 'Новый пароль должен отличаться от текущего.';
  }
  if (normalized.includes('new password is required')) {
    return 'Введите новый пароль.';
  }
  if (
    normalized.includes('invalid email or password') ||
    normalized.includes('invalid credentials')
  ) {
    return 'Неверный email или пароль.';
  }
  if (normalized.includes('token is invalid or expired')) {
    return 'Ссылка недействительна или истекла.';
  }
  if (normalized.includes('token is required')) {
    return 'Отсутствует токен подтверждения.';
  }
  if (normalized.includes('user with this email already exists')) {
    return 'Пользователь с таким email уже существует.';
  }
  if (normalized.includes('user not found')) {
    return 'Пользователь не найден.';
  }

  return null;
}

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
  if (typeof err?.code === 'string') {
    const byCode = API_ERROR_CODE_RU[err.code];
    if (byCode) return byCode;
  }
  if (typeof err?.message === 'string') {
    const translated = translateCommonEnglishError(err.message);
    if (translated) return translated;
    return err.message;
  }
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

