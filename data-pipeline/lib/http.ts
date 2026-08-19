import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const CACHE_DIR = path.resolve(import.meta.dirname, '../.cache');
const FRESH = process.env.DATA_FRESH === '1';

const USER_AGENT = 'GeopoliticalAtlasBot/0.1 (personal/non-commercial research project; contact: tim@tjh.li)';

async function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) await mkdir(CACHE_DIR, { recursive: true });
}

/** Fetch JSON with an on-disk cache so re-running the pipeline during dev doesn't hammer public APIs. */
export async function cachedFetchJson<T>(url: string, cacheKey: string, init?: RequestInit): Promise<T> {
  await ensureCacheDir();
  const cachePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  if (!FRESH && existsSync(cachePath)) {
    return JSON.parse(await readFile(cachePath, 'utf-8')) as T;
  }
  const text = await fetchWithRetry(url, init);
  let json: T;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response for ${url}: ${text.slice(0, 300)}`);
  }
  await writeFile(cachePath, JSON.stringify(json), 'utf-8');
  return json;
}


/** Statuses worth another attempt: rate limiting and the gateway errors WDQS
 * returns under load. Anything else (404, malformed query) will fail again. */
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 5;

async function fetchWithRetry(url: string, init?: RequestInit): Promise<string> {
  let lastError = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(init?.headers ?? {}) },
      });
    } catch (err) {
      lastError = `network error: ${(err as Error).message}`;
      await sleep(attempt * 3000);
      continue;
    }
    if (res.ok) return res.text();
    lastError = `${res.status} ${res.statusText}`;
    if (!RETRYABLE.has(res.status) || attempt === MAX_ATTEMPTS) break;
    const backoff = attempt * 5000;
    console.warn(`  retrying after ${lastError} (attempt ${attempt}/${MAX_ATTEMPTS}, waiting ${backoff / 1000}s)`);
    await sleep(backoff);
  }
  throw new Error(`Fetch failed (${lastError}) for ${url}`);
}

const WDQS = 'https://query.wikidata.org/sparql';

export interface SparqlBindingValue {
  type: string;
  value: string;
}
export interface SparqlResult {
  results: { bindings: Record<string, SparqlBindingValue>[] };
}

let lastWdqsCall = 0;

/** Wikidata Query Service is rate-sensitive; keep queries small/simple and pace requests. */
export async function sparql(query: string, cacheKey: string): Promise<SparqlResult['results']['bindings']> {
  const sinceLast = Date.now() - lastWdqsCall;
  if (sinceLast < 400) await sleep(400 - sinceLast);
  lastWdqsCall = Date.now();

  const url = `${WDQS}?query=${encodeURIComponent(query)}`;
  const result = await cachedFetchJson<SparqlResult>(url, `wd-${cacheKey}`, {
    headers: { Accept: 'application/sparql-results+json' },
  });
  return result.results.bindings;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function qidFromUri(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  const match = uri.match(/Q\d+$/);
  return match ? match[0] : undefined;
}

export async function writePublicData(relPath: string, data: unknown) {
  const outPath = path.resolve(import.meta.dirname, '../../public/data', relPath);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`wrote public/data/${relPath}`);
}
