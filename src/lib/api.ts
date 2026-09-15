import type { CountryProfile, GeoEvent, NewsResponse, PoliticalHistory, Relationship, RecognitionStatus } from '../types/domain';
import type { WorldGeometry } from '../types/geo';

export interface CountryIndexEntry {
  id: string;
  name: string;
  officialName: string;
  region: string;
  flagEmoji: string;
  hasDeepData: boolean;
  recognitionStatus: RecognitionStatus;
  centroid: [number, number] | null;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new HttpError(res.status, `Failed to load ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchCountryIndex = () => getJson<CountryIndexEntry[]>('/data/countries/index.json');

export const fetchWorldGeometry = () => getJson<WorldGeometry>('/data/geometry/world.json');

export const fetchEvents = () => getJson<GeoEvent[]>('/data/events.json');

export const fetchRelationships = () => getJson<Relationship[]>('/data/relationships.json');

// A rejected fetch is evicted rather than cached, so a transient failure
// doesn't permanently poison the entry - the next call retries instead of
// replaying the same cached error for the rest of the session.
const countryCache = new Map<string, Promise<CountryProfile>>();
export function fetchCountry(id: string): Promise<CountryProfile> {
  let cached = countryCache.get(id);
  if (!cached) {
    cached = getJson<CountryProfile>(`/data/countries/${id}.json`);
    cached.catch(() => countryCache.delete(id));
    countryCache.set(id, cached);
  }
  return cached;
}

/**
 * Post-1945 leadership record. Countries with no Wikidata coverage have no
 * file at all, so a 404 resolves to null rather than surfacing as an error.
 * Any other failure (a network error, a non-404 status) is evicted rather
 * than cached as null, so it doesn't get indistinguishable from "no data"
 * and can be retried.
 */
const politicsCache = new Map<string, Promise<PoliticalHistory | null>>();
export function fetchPoliticalHistory(id: string): Promise<PoliticalHistory | null> {
  let cached = politicsCache.get(id);
  if (!cached) {
    cached = getJson<PoliticalHistory>(`/data/politics/${id}.json`).catch((err) => {
      if (err instanceof HttpError && err.status === 404) return null;
      politicsCache.delete(id);
      throw err;
    });
    politicsCache.set(id, cached);
  }
  return cached;
}

export function fetchGlobalNews(): Promise<NewsResponse> {
  return getJson<NewsResponse>('/api/news/global');
}

export function fetchCountryNews(id: string): Promise<NewsResponse> {
  return getJson<NewsResponse>(`/api/news/${id}`);
}
