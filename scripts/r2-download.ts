import 'dotenv/config';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../src/data');

const DEFAULT_BUCKET = 'aierastack-data';
const DEFAULT_PREFIX = 'repos/';
const REMOTE_FLAG = '--remote';
const NPX_CMD = process.platform === 'win32' ? 'npx.cmd' : 'npx';

interface R2ListEntry {
  key?: string;
  name?: string;
}

interface WranglerAttempt {
  args: string[];
  writesToFile: boolean;
}

interface WranglerResult {
  output: string;
  writesToFile: boolean;
  args: string[];
}

function getArgValue(flag: string): string | null {
  const inlinePrefix = `${flag}=`;
  const inlineArg = process.argv.find((arg) => arg.startsWith(inlinePrefix));
  if (inlineArg) {
    return inlineArg.slice(inlinePrefix.length);
  }
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) return null;
  return value;
}

function warnIfMissingAuth(): void {
  const missing: string[] = [];
  if (!process.env.CLOUDFLARE_API_TOKEN) missing.push('CLOUDFLARE_API_TOKEN');
  if (!process.env.CLOUDFLARE_ACCOUNT_ID) missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (missing.length > 0) {
    console.log(`Warning: missing ${missing.join(', ')}. Falling back to local wrangler auth.`);
  }
}

function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['inherit', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      const message = `Command failed (${code ?? 'unknown'}): ${command} ${args.join(' ')}\n${stderr || stdout}`;
      reject(new Error(message.trim()));
    });
  });
}

async function runWrangler(args: string[]): Promise<string> {
  return runCommand(NPX_CMD, ['wrangler', ...args]);
}

function shouldRetryWithFallback(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return [
    /unknown (arguments?|option|flag|command)s?/i,
    /unexpected argument/i,
    /missing required option/i,
    /not a valid command/i,
  ].some((pattern) => pattern.test(message));
}

async function runWranglerWithFallback(attempts: WranglerAttempt[]): Promise<WranglerResult> {
  let lastError: Error | null = null;
  for (const attempt of attempts) {
    try {
      const output = await runWrangler(attempt.args);
      return { output, writesToFile: attempt.writesToFile, args: attempt.args };
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;
      if (!shouldRetryWithFallback(err)) break;
    }
  }
  if (lastError) throw lastError;
  throw new Error('Wrangler command failed without a captured error.');
}

function extractJsonArray(output: string): unknown {
  const trimmed = output.trim();
  if (!trimmed) return [];
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const start = trimmed.indexOf('[');
    const end = trimmed.lastIndexOf(']');
    if (start >= 0 && end > start) {
      const sliced = trimmed.slice(start, end + 1);
      try {
        return JSON.parse(sliced) as unknown;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function extractJsonPayload(output: string): string | null {
  const trimmed = output.trim();
  if (!trimmed) return null;
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // ignore
  }
  const objStart = trimmed.indexOf('{');
  const objEnd = trimmed.lastIndexOf('}');
  if (objStart >= 0 && objEnd > objStart) {
    const candidate = trimmed.slice(objStart, objEnd + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // ignore
    }
  }
  const arrStart = trimmed.indexOf('[');
  const arrEnd = trimmed.lastIndexOf(']');
  if (arrStart >= 0 && arrEnd > arrStart) {
    const candidate = trimmed.slice(arrStart, arrEnd + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // ignore
    }
  }
  return null;
}

function collectKeysFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const keys: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as R2ListEntry;
    if (typeof entry.key === 'string') {
      keys.push(entry.key);
      continue;
    }
    if (typeof entry.name === 'string') {
      keys.push(entry.name);
    }
  }
  return keys;
}

function collectKeysFromText(output: string, prefix: string): string[] {
  const keys: string[] = [];
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.toLowerCase().startsWith('name')) continue;
    if (trimmed.toLowerCase().startsWith('key')) continue;
    const firstToken = trimmed.split(/\s+/)[0];
    if (firstToken.startsWith(prefix)) {
      keys.push(firstToken);
    }
  }
  return keys;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizePrefix(prefix: string): string {
  return prefix.endsWith('/') ? prefix : `${prefix}/`;
}

function readJsonFile(filePath: string): unknown | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as unknown;
  } catch {
    return null;
  }
}

function listRepoKeysFromLocal(prefix: string): string[] {
  const normalizedPrefix = normalizePrefix(prefix);
  const candidates = [join(DATA_DIR, 'index.json')];
  const repoKeys: string[] = [];
  for (const filePath of candidates) {
    const data = readJsonFile(filePath);
    if (!data || typeof data !== 'object') continue;
    const repos = (data as { repos?: Record<string, unknown> }).repos;
    if (!repos || typeof repos !== 'object') continue;
    for (const key of Object.keys(repos)) {
      repoKeys.push(`${normalizedPrefix}${key}.json`);
    }
  }
  return uniq(repoKeys);
}

function buildListAttempts(bucket: string, prefix: string): WranglerAttempt[] {
  const bases = [
    ['r2', 'object', 'list', bucket],
    ['r2', 'object', 'list', '--bucket', bucket],
  ];
  const attempts: WranglerAttempt[] = [];
  for (const base of bases) {
    const baseWithPrefix = [...base, '--prefix', prefix];
    attempts.push({ args: [...baseWithPrefix, REMOTE_FLAG, '--json'], writesToFile: false });
    attempts.push({ args: [...baseWithPrefix, '--json'], writesToFile: false });
    attempts.push({ args: [...baseWithPrefix, REMOTE_FLAG], writesToFile: false });
    attempts.push({ args: [...baseWithPrefix], writesToFile: false });
  }
  return attempts;
}

function buildGetAttempts(bucket: string, key: string, filePath: string): WranglerAttempt[] {
  const bases = [
    ['r2', 'object', 'get', `${bucket}/${key}`],
    ['r2', 'object', 'get', bucket, key],
    ['r2', 'object', 'get', '--bucket', bucket, '--key', key],
  ];
  const attempts: WranglerAttempt[] = [];
  for (const base of bases) {
    attempts.push({ args: [...base, '--file', filePath, REMOTE_FLAG], writesToFile: true });
    attempts.push({ args: [...base, '--file', filePath], writesToFile: true });
    attempts.push({ args: [...base, REMOTE_FLAG], writesToFile: false });
    attempts.push({ args: [...base], writesToFile: false });
  }
  return attempts;
}

async function listRepoKeys(bucket: string, prefix: string): Promise<string[]> {
  try {
    const { output } = await runWranglerWithFallback(buildListAttempts(bucket, prefix));
    const parsed = extractJsonArray(output);
    const jsonKeys = collectKeysFromJson(parsed);
    if (jsonKeys.length > 0) return uniq(jsonKeys);
    return uniq(collectKeysFromText(output, prefix));
  } catch (error) {
    const fallbackKeys = listRepoKeysFromLocal(prefix);
    if (fallbackKeys.length > 0) {
      const message = error instanceof Error ? error.message : String(error);
      const firstLine = message.split('\n')[0];
      console.warn(`Wrangler list failed (${firstLine}). Falling back to index.json.`);
      return fallbackKeys;
    }
    throw error;
  }
}

async function downloadObject(bucket: string, key: string, filePath: string): Promise<boolean> {
  mkdirSync(dirname(filePath), { recursive: true });
  try {
    const { output, writesToFile } = await runWranglerWithFallback(buildGetAttempts(bucket, key, filePath));
    if (!writesToFile) {
      const payload = extractJsonPayload(output);
      if (!payload) {
        throw new Error('Received non-JSON output from wrangler.');
      }
      writeFileSync(filePath, payload);
    }
    console.log(`Downloaded ${key}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Skipped ${key}: ${message.split('\n')[0]}`);
    return false;
  }
}

async function main(): Promise<void> {
  const bucket = getArgValue('--bucket') ?? process.env.R2_BUCKET ?? DEFAULT_BUCKET;
  const prefix = getArgValue('--prefix') ?? DEFAULT_PREFIX;

  warnIfMissingAuth();

  console.log(`Bucket: ${bucket}`);
  console.log(`Prefix: ${prefix}`);

  await downloadObject(bucket, 'index.json', join(DATA_DIR, 'index.json'));

  const keys = await listRepoKeys(bucket, prefix);
  const repoKeys = keys
    .filter((key) => key.startsWith(prefix))
    .filter((key) => key.endsWith('.json'));

  if (repoKeys.length === 0) {
    console.log('No repo files found under prefix.');
    return;
  }

  console.log(`Downloading ${repoKeys.length} repo files...`);
  let successCount = 0;
  for (const key of repoKeys) {
    const filePath = join(DATA_DIR, key);
    const ok = await downloadObject(bucket, key, filePath);
    if (ok) successCount += 1;
  }

  console.log(`Done. Downloaded ${successCount}/${repoKeys.length} repo files.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
