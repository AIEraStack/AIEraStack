import * as Sentry from '@sentry/cloudflare';
import type { CloudflareOptions } from '@sentry/cloudflare';
import type { ExecutionContext } from '@cloudflare/workers-types';

export type SentryEnv = {
  SENTRY_DSN?: string;
  SENTRY_ENV?: string;
  SENTRY_RELEASE?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
};

export type SentryExecutionContext = ExecutionContext;

type CaptureOptions = {
  request?: Request;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  waitUntil?: (promise: Promise<unknown>) => void;
};

let asyncContextReady = false;

function ensureAsyncContext(): void {
  if (asyncContextReady) {
    return;
  }
  Sentry.setAsyncLocalStorageAsyncContextStrategy();
  asyncContextReady = true;
}

function parseSampleRate(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return undefined;
  }
  return parsed;
}

export function getSentryOptions(env?: SentryEnv): CloudflareOptions | null {
  const dsn = env?.SENTRY_DSN;
  if (!dsn) {
    return null;
  }

  const tracesSampleRate = parseSampleRate(env?.SENTRY_TRACES_SAMPLE_RATE);
  const options: CloudflareOptions = {
    dsn,
    environment: env?.SENTRY_ENV,
    release: env?.SENTRY_RELEASE,
  };

  if (tracesSampleRate !== undefined) {
    options.tracesSampleRate = tracesSampleRate;
  }

  return options;
}

export function withSentryRequest(
  options: CloudflareOptions | null,
  request: Request,
  context: SentryExecutionContext | undefined,
  handler: () => Response | Promise<Response>
): Response | Promise<Response> {
  if (!options) {
    return handler();
  }

  ensureAsyncContext();

  const safeContext: SentryExecutionContext =
    context ??
    ({
      waitUntil: () => undefined,
      passThroughOnException: () => undefined,
      props: {},
    } satisfies SentryExecutionContext);

  return Sentry.wrapRequestHandler(
    {
      options,
      request,
      context: safeContext,
    },
    handler
  );
}

export function captureException(error: unknown, options: CaptureOptions = {}): void {
  if (!Sentry.isEnabled()) {
    return;
  }

  const requestInfo = options.request
    ? { method: options.request.method, url: options.request.url }
    : undefined;

  Sentry.captureException(error, {
    tags: options.tags,
    extra: {
      ...(requestInfo ? { request: requestInfo } : {}),
      ...(options.extra ?? {}),
    },
  });

  if (options.waitUntil) {
    options.waitUntil(Sentry.flush(2000));
  }
}
