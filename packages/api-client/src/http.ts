import { type ApiErrorBody, IDEMPOTENCY_HEADER } from '@storyme/shared-types';

export interface ApiClientOptions {
  /** API origin, e.g. https://api.storyme.app */
  baseUrl: string;
  /** Returns the current access token (or null). Called per request. */
  getToken?: () => string | null | Promise<string | null>;
  /** Injected fetch (defaults to global fetch); handy for tests / RN. */
  fetch?: typeof fetch;
}

/** Thrown for any non-2xx response; carries the parsed ApiErrorBody. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.error?.message ?? `Request failed (${status})`);
    this.name = 'ApiError';
  }

  get code(): string {
    return this.body.error?.code ?? 'internal_error';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

/** Minimal, dependency-free typed HTTP core shared by web and mobile. */
export class HttpCore {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: ApiClientOptions) {
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(path.replace(/^\//, ''), this.ensureTrailingSlash(this.opts.baseUrl));
    for (const [k, v] of Object.entries(options.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    const token = await this.opts.getToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.idempotencyKey) headers[IDEMPOTENCY_HEADER] = options.idempotencyKey;

    const res = await this.fetchImpl(url.toString(), {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });

    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;
    if (!res.ok) {
      throw new ApiError(res.status, json as ApiErrorBody);
    }
    return json as T;
  }

  private ensureTrailingSlash(base: string): string {
    return base.endsWith('/') ? base : `${base}/`;
  }
}
