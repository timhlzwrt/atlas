import type { NewsArticle, NewsResponse } from '../../../src/types/domain';

export interface Env {
  GNEWS_API_KEY: string;
  NEWS_CACHE: KVNamespace;
}

const GNEWS_BASE = 'https://gnews.io/api/v4';

// Conservative daily budget under GNews's 100 req/day free-tier cap, split
// into two independent pools so a burst of country requests can't exhaust
// the global feed's budget (or vice versa). Workers KV has no atomic
// increment or compare-and-swap, so withinBudget's read-then-write below is
// a known TOCTOU race: two concurrent requests near a pool's cap can both
// read the same under-budget count and both proceed. The two pools together
// (70 + 20 = 90) stay comfortably under the real 100/day cap to absorb
// that, rather than trying to eliminate the race outright, which would need
// a Durable Object rather than KV.
const GLOBAL_CACHE_TTL_SECONDS = 2 * 60 * 60; // refetch at most every 2h
const COUNTRY_CACHE_TTL_SECONDS = 6 * 60 * 60; // refetch at most every 6h
type BudgetScope = 'global' | 'country';
const DAILY_BUDGETS: Record<BudgetScope, number> = { global: 20, country: 70 };

interface GNewsArticle {
  title?: string;
  url?: string;
  publishedAt?: string;
  source?: { name?: string };
}
interface GNewsResponse {
  articles?: GNewsArticle[];
}

function todayKey(scope: BudgetScope): string {
  return `budget:${scope}:${new Date().toISOString().slice(0, 10)}`;
}

async function withinBudget(kv: KVNamespace, scope: BudgetScope): Promise<boolean> {
  const dailyBudget = DAILY_BUDGETS[scope];
  const key = todayKey(scope);
  const raw = Number((await kv.get(key)) ?? '0');
  // A corrupted/non-numeric stored value must not silently disable the cap:
  // fail closed (treat as already at budget) rather than let `NaN >=
  // dailyBudget` stay false forever and pass every request through
  // unmetered - and re-persist "NaN" - for the rest of the day.
  const current = Number.isFinite(raw) ? raw : dailyBudget;
  if (current >= dailyBudget) return false;
  await kv.put(key, String(current + 1), { expirationTtl: 26 * 60 * 60 });
  return true;
}

function normalizeArticles(res: GNewsResponse): NewsArticle[] {
  return (res.articles ?? [])
    .filter((a) => a.title && a.url && a.publishedAt)
    .map((a) => ({
      title: a.title!,
      url: a.url!,
      publishedAt: a.publishedAt!,
      publisher: a.source?.name ?? 'Unknown publisher',
    }));
}

async function callGNews(env: Env, path: string, params: Record<string, string>): Promise<NewsArticle[]> {
  const url = new URL(`${GNEWS_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('apikey', env.GNEWS_API_KEY);

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`GNews error ${res.status}`);
  const json = (await res.json()) as GNewsResponse;
  return normalizeArticles(json);
}

/**
 * Fetch-or-cache pattern shared by global and per-country news: serve from
 * KV if fresh, otherwise hit GNews (if the daily budget allows) and cache the
 * result. If the budget is exhausted and we have *any* cached copy (even
 * stale), serve it rather than failing — the UI marks it as stale.
 */
export async function getCachedNews(
  env: Env,
  cacheKey: string,
  ttlSeconds: number,
  scope: BudgetScope,
  fetchFresh: () => Promise<NewsArticle[]>,
): Promise<NewsResponse> {
  const cached = await env.NEWS_CACHE.get<{ articles: NewsArticle[]; fetchedAt: string }>(cacheKey, 'json');

  if (cached) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age < ttlSeconds * 1000) {
      return { articles: cached.articles, fetchedAt: cached.fetchedAt, stale: false };
    }
  }

  const hasBudget = await withinBudget(env.NEWS_CACHE, scope);
  if (!hasBudget) {
    if (cached) return { articles: cached.articles, fetchedAt: cached.fetchedAt, stale: true };
    return { articles: [], fetchedAt: new Date().toISOString(), stale: true };
  }

  try {
    const articles = await fetchFresh();
    const fetchedAt = new Date().toISOString();
    await env.NEWS_CACHE.put(cacheKey, JSON.stringify({ articles, fetchedAt }), {
      expirationTtl: ttlSeconds * 4, // keep a stale copy around well past freshness for fallback
    });
    return { articles, fetchedAt, stale: false };
  } catch {
    if (cached) return { articles: cached.articles, fetchedAt: cached.fetchedAt, stale: true };
    return { articles: [], fetchedAt: new Date().toISOString(), stale: true };
  }
}

export function fetchGlobalHeadlines(env: Env): Promise<NewsArticle[]> {
  return callGNews(env, '/top-headlines', { category: 'world', lang: 'en', max: '10' });
}

export function fetchCountryHeadlines(env: Env, countryName: string): Promise<NewsArticle[]> {
  return callGNews(env, '/search', { q: `"${countryName}"`, lang: 'en', sortby: 'publishedAt', max: '10' });
}

export const GLOBAL_TTL = GLOBAL_CACHE_TTL_SECONDS;
export const COUNTRY_TTL = COUNTRY_CACHE_TTL_SECONDS;

export function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      ...init?.headers,
    },
  });
}
