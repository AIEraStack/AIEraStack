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
}

declare namespace App {
  interface Locals {
    runtime?: {
      env?: CloudflareEnv;
    };
  }
}
