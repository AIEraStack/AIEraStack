/// <reference types="astro/client" />

interface R2Object {
  json(): Promise<unknown>;
}

interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: string, options?: { httpMetadata?: { contentType?: string } }): Promise<void>;
}

interface CloudflareEnv {
  DATA_BUCKET?: R2Bucket;
  GITHUB_TOKEN?: string;
  SENTRY_DSN?: string;
  SENTRY_ENV?: string;
  SENTRY_RELEASE?: string;
  SENTRY_TRACES_SAMPLE_RATE?: string;
}

interface CloudflareRuntimeContext {
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
  props: Record<string, unknown>;
}

interface CloudflareRuntime {
  env?: CloudflareEnv;
  cf?: Record<string, unknown>;
  caches?: CacheStorage;
  ctx?: CloudflareRuntimeContext;
}

declare namespace App {
  interface Locals {
    runtime?: CloudflareRuntime;
  }
}
