/**
 * Shared HTTP foundation for anchor integrations.
 *
 * Centralises authenticated request construction, retry handling for transient
 * failures and rate limits, and AnchorError normalisation so concrete clients
 * can focus on provider-specific endpoint mapping.
 */

import type { Anchor } from "./types";
import { AnchorError } from "./types";

export type AnchorHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type HeaderFactory = () => HeadersInit;

interface BaseAnchorClientOptions {
  baseUrl?: string;
  fetchFn?: typeof fetch;
  defaultHeaders?: HeaderFactory;
  maxRetries?: number;
  retryBaseDelayMs?: number;
}

interface AnchorRequestOptions {
  body?: unknown;
  headers?: HeadersInit;
  isJson?: boolean;
  retry?: boolean;
}

interface NormalizedErrorPayload {
  message?: string;
  code?: string;
}

/** Base class shared by HTTP-backed anchor clients. */
export abstract class BaseAnchorClient implements Partial<Anchor> {
  abstract readonly name: string;

  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly defaultHeaders: HeaderFactory;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;

  protected constructor({
    baseUrl = "",
    fetchFn = fetch,
    defaultHeaders = () => ({}),
    maxRetries = 2,
    retryBaseDelayMs = 250,
  }: BaseAnchorClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchFn = fetchFn;
    this.defaultHeaders = defaultHeaders;
    this.maxRetries = maxRetries;
    this.retryBaseDelayMs = retryBaseDelayMs;
  }

  /** Build a fetch-compatible function that applies shared retry handling. */
  protected createRetryingFetch(): typeof fetch {
    return ((input: RequestInfo | URL, init?: RequestInit) =>
      this.fetchWithRetry(input, init)) as typeof fetch;
  }

  /** Send an authenticated JSON request and parse the response as JSON. */
  protected async request<T>(
    method: AnchorHttpMethod,
    endpoint: string,
    bodyOrOptions?: unknown | AnchorRequestOptions,
  ): Promise<T> {
    const options = this.normalizeRequestOptions(bodyOrOptions);
    const url = this.buildUrl(endpoint);
    const isJson = options.isJson ?? true;
    const headers = this.mergeHeaders(
      isJson ? { "Content-Type": "application/json" } : {},
      this.defaultHeaders(),
      options.headers,
    );

    console.log(
      `[${this.displayName}] ${method} ${url}`,
      options.body ? this.safeStringify(options.body) : "",
    );

    const response = await this.fetchWithRetry(
      url,
      {
        method,
        headers,
        body: options.body
          ? isJson
            ? JSON.stringify(options.body)
            : (options.body as BodyInit)
          : undefined,
      },
      options.retry,
    );

    if (!response.ok) {
      await this.throwAnchorError(response);
    }

    const text = await response.text();
    console.log(`[${this.displayName}] Response:`, text || "(empty)");

    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  /** Send an authenticated non-JSON request, e.g. multipart uploads. */
  protected async requestRaw<T>(
    method: AnchorHttpMethod,
    endpoint: string,
    body: BodyInit,
    headers?: HeadersInit,
  ): Promise<T> {
    return this.request<T>(method, endpoint, { body, headers, isJson: false });
  }

  protected buildUrl(endpoint: string): string {
    if (/^https?:\/\//i.test(endpoint)) {
      return endpoint;
    }
    return `${this.baseUrl}${endpoint}`;
  }

  protected async fetchWithRetry(
    input: RequestInfo | URL,
    init?: RequestInit,
    retry = true,
  ): Promise<Response> {
    const attempts = retry ? this.maxRetries + 1 : 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await this.fetchFn(input, init);
        if (!this.shouldRetryResponse(response) || attempt === attempts - 1) {
          return response;
        }
        await this.delay(this.getRetryDelayMs(response, attempt));
      } catch (error) {
        lastError = error;
        if (attempt === attempts - 1) {
          break;
        }
        await this.delay(this.getBackoffDelayMs(attempt));
      }
    }

    throw lastError;
  }

  protected getErrorCode(payload: unknown): string | undefined {
    const normalized = this.normalizeErrorPayload(payload);
    return normalized.code;
  }

  protected getErrorMessage(payload: unknown): string | undefined {
    const normalized = this.normalizeErrorPayload(payload);
    return normalized.message;
  }

  private async throwAnchorError(response: Response): Promise<never> {
    const errorText = await response.text();
    console.error(`[${this.displayName}] Error ${response.status}:`, errorText);

    let payload: unknown;
    try {
      payload = errorText ? JSON.parse(errorText) : undefined;
    } catch {
      payload = undefined;
    }

    throw new AnchorError(
      this.getErrorMessage(payload) ||
        errorText ||
        `${this.displayName} API error: ${response.status}`,
      this.getErrorCode(payload) || "UNKNOWN_ERROR",
      response.status,
    );
  }

  private normalizeErrorPayload(payload: unknown): NormalizedErrorPayload {
    if (!payload || typeof payload !== "object") return {};
    const data = payload as Record<string, unknown>;
    const nested =
      typeof data.error === "object" && data.error
        ? (data.error as Record<string, unknown>)
        : data;
    return {
      message: typeof nested.message === "string" ? nested.message : undefined,
      code: typeof nested.code === "string" ? nested.code : undefined,
    };
  }

  private shouldRetryResponse(response: Response): boolean {
    return (
      response.status === 429 ||
      response.status === 408 ||
      response.status >= 500
    );
  }

  private getRetryDelayMs(response: Response, attempt: number): number {
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) return seconds * 1000;
      const dateMs = Date.parse(retryAfter);
      if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
    }
    return this.getBackoffDelayMs(attempt);
  }

  private getBackoffDelayMs(attempt: number): number {
    return this.retryBaseDelayMs * 2 ** attempt;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private normalizeRequestOptions(
    bodyOrOptions?: unknown | AnchorRequestOptions,
  ): AnchorRequestOptions {
    if (
      bodyOrOptions &&
      typeof bodyOrOptions === "object" &&
      ("body" in bodyOrOptions ||
        "headers" in bodyOrOptions ||
        "isJson" in bodyOrOptions ||
        "retry" in bodyOrOptions)
    ) {
      return bodyOrOptions as AnchorRequestOptions;
    }
    return { body: bodyOrOptions };
  }

  private mergeHeaders(
    ...headersList: Array<HeadersInit | undefined>
  ): Headers {
    const merged = new Headers();
    for (const headers of headersList) {
      if (!headers) continue;
      new Headers(headers).forEach((value, key) => merged.set(key, value));
    }
    return merged;
  }

  private safeStringify(value: unknown): string {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private get displayName(): string {
    return this.name.charAt(0).toUpperCase() + this.name.slice(1);
  }
}
