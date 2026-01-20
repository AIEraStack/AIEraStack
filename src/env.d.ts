/// <reference types="astro/client" />

interface D1Result<T> {
  results: T[];
  success: boolean;
  meta: { changes: number; last_row_id: number; duration: number };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result<unknown>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number }>;
}

interface CloudflareEnv {
  DB?: D1Database;
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
