import type { CountryProfile, GeoEvent, NewsResponse, Relationship, RecognitionStatus } from '../types/domain';
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

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchCountryIndex = () => getJson<CountryIndexEntry[]>('/data/countries/index.json');

export const fetchWorldGeometry = () => getJson<WorldGeometry>('/data/geometry/world.json');

export const fetchEvents = () => getJson<GeoEvent[]>('/data/events.json');

export const fetchRelationships = () => getJson<Relationship[]>('/data/relationships.json');

const countryCache = new Map<string, Promise<CountryProfile>>();
export function fetchCountry(id: string): Promise<CountryProfile> {
  let cached = countryCache.get(id);
  if (!cached) {
    cached = getJson<CountryProfile>(`/data/countries/${id}.json`);
    countryCache.set(id, cached);
  }
  return cached;
}

export function fetchGlobalNews(): Promise<NewsResponse> {
  return getJson<NewsResponse>('/api/news/global');
}

export function fetchCountryNews(id: string): Promise<NewsResponse> {
  return getJson<NewsResponse>(`/api/news/${id}`);
}
