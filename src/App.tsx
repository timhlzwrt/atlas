import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { GlobeHandle } from './components/Globe/Globe';
import { CountryCard } from './components/CountryCard/CountryCard';
import { Search } from './components/Search/Search';
import { Timeline } from './components/Timeline/Timeline';
import { Compare } from './components/Compare/Compare';
import { SourcesPanel } from './components/Sources/SourcesPanel';
import { NewsList } from './components/News/NewsList';
import { useSelectionStore } from './state/selectionStore';
import { useTimeStore } from './state/timeStore';
import { fetchCountryIndex, fetchEvents, fetchRelationships, fetchWorldGeometry, type CountryIndexEntry } from './lib/api';
import type { GeoEvent, Relationship } from './types/domain';
import type { WorldGeometry } from './types/geo';
import './App.css';

// three.js/react-globe.gl dominate the bundle (~600KB gzipped) — split it into
// its own chunk so the header/shell paints immediately while it loads.
const Globe = lazy(() => import('./components/Globe/Globe'));

export default function App() {
  const [countryIndex, setCountryIndex] = useState<CountryIndexEntry[]>([]);
  const [geometry, setGeometry] = useState<WorldGeometry | null>(null);
  const [events, setEvents] = useState<GeoEvent[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [globalNewsOpen, setGlobalNewsOpen] = useState(false);

  const globeRef = useRef<GlobeHandle>(null);
  const selectedCountryId = useSelectionStore((s) => s.selectedCountryId);
  const selectCountry = useSelectionStore((s) => s.selectCountry);
  const selectedEventId = useTimeStore((s) => s.selectedEventId);
  const mode = useTimeStore((s) => s.mode);

  useEffect(() => {
    fetchCountryIndex().then(setCountryIndex);
    fetchWorldGeometry().then(setGeometry);
    fetchEvents().then(setEvents);
    fetchRelationships().then(setRelationships);
  }, []);

  const countryMap = useMemo(() => new Map(countryIndex.map((c) => [c.id, c])), [countryIndex]);
  const disputedIds = useMemo(
    () => new Set(countryIndex.filter((c) => c.recognitionStatus !== 'un-member').map((c) => c.id)),
    [countryIndex],
  );
  const selectedCountry = selectedCountryId ? countryMap.get(selectedCountryId) : null;
  const selectedEvent = selectedEventId ? events.find((e) => e.id === selectedEventId) : null;

  const goTo = (id: string) => {
    selectCountry(id);
    globeRef.current?.flyToCountry(id);
  };

  const loading = countryIndex.length === 0 || !geometry;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__mark">◍</span>
          GEOPOLITICAL ATLAS
        </div>
        <Search countries={countryIndex} onSelect={goTo} />
        <div className="app-header__right">
          <button className="app-header__link" onClick={() => setGlobalNewsOpen((v) => !v)}>
            News
          </button>
          <button className="app-header__link" onClick={() => setSourcesOpen(true)}>
            Sources
          </button>
          <span className="app-header__date">
            {mode === 'historical' && selectedEvent ? selectedEvent.date.slice(0, 4) : new Date().getFullYear()}
          </span>
        </div>
      </header>

      <main className="app-main">
        {loading ? (
          <div className="app-loading">
            <div className="app-loading__spinner" />
            <p>Loading the atlas…</p>
          </div>
        ) : (
          <Suspense
            fallback={
              <div className="app-loading">
                <div className="app-loading__spinner" />
                <p>Loading the globe…</p>
              </div>
            }
          >
            <Globe geometry={geometry} countryIndex={countryMap} disputedIds={disputedIds} relationships={relationships} ref={globeRef}>
              {selectedCountryId && <CountryCard countryId={selectedCountryId} events={events} onSelectCountry={goTo} />}
            </Globe>
          </Suspense>
        )}

        {globalNewsOpen && (
          <div className="global-news-panel">
            <div className="global-news-panel__header">
              <h3>Global News</h3>
              <button onClick={() => setGlobalNewsOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <NewsList />
          </div>
        )}
      </main>

      <footer className="app-footer">
        <Timeline events={events} selectedCountryId={selectedCountryId} selectedCountryName={selectedCountry?.name ?? null} />
      </footer>

      <Compare countries={countryIndex} />
      {sourcesOpen && <SourcesPanel onClose={() => setSourcesOpen(false)} />}
    </div>
  );
}
