import { useEffect, useState, type ReactNode } from 'react';
import { useSelectionStore } from '../../state/selectionStore';
import { useLayersStore } from '../../state/layersStore';
import { fetchCountry } from '../../lib/api';
import type { CountryProfile, GeoEvent, RelationshipType } from '../../types/domain';
import { StatItem } from './StatItem';
import { formatCompact, formatCurrencyCompact, formatNumber, formatPercent } from './formatters';
import { NewsList } from '../News/NewsList';
import './countryCard.css';

const RECOGNITION_LABEL: Record<string, string> = {
  'un-member': '',
  'un-observer': 'UN observer state',
  'partially-recognized': 'Partially recognized',
  disputed: 'Disputed territory',
  'de-facto': 'De facto independent',
};

const LAYER_OPTIONS: { type: RelationshipType; label: string }[] = [
  { type: 'alliance', label: 'Alliances' },
  { type: 'trade', label: 'Trade' },
  { type: 'military', label: 'Military' },
  { type: 'diplomatic', label: 'Diplomatic' },
  { type: 'conflict', label: 'Conflicts' },
];

interface CountryCardProps {
  countryId: string;
  events: GeoEvent[];
  onSelectCountry: (id: string) => void;
}

export function CountryCard({ countryId, events, onSelectCountry }: CountryCardProps) {
  const [profile, setProfile] = useState<CountryProfile | null>(null);
  const [error, setError] = useState(false);
  const expanded = useSelectionStore((s) => s.cardExpanded);
  const setExpanded = useSelectionStore((s) => s.setCardExpanded);
  const selectCountry = useSelectionStore((s) => s.selectCountry);
  const openCompare = useSelectionStore((s) => s.openCompare);

  useEffect(() => {
    setProfile(null);
    setError(false);
    fetchCountry(countryId)
      .then(setProfile)
      .catch(() => setError(true));
  }, [countryId]);

  if (error) {
    return (
      <div className="country-card country-card--loading">
        <p>Couldn't load this country's data.</p>
        <button onClick={() => selectCountry(null)}>Close</button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="country-card country-card--loading" aria-busy="true">
        <div className="skeleton-line" style={{ width: '60%' }} />
        <div className="skeleton-line" style={{ width: '40%' }} />
        <div className="skeleton-line" style={{ width: '80%' }} />
      </div>
    );
  }

  const recognitionLabel = RECOGNITION_LABEL[profile.recognitionStatus];
  const countryEvents = events.filter((e) => e.countries.includes(profile.id)).slice(0, 8);

  return (
    <div className={`country-card ${expanded ? 'country-card--expanded' : ''}`}>
      <header className="country-card__header">
        <span className="country-card__flag" aria-hidden="true">
          {profile.flagEmoji}
        </span>
        <div className="country-card__title">
          <h2>{profile.name}</h2>
          {profile.officialName !== profile.name && <p className="country-card__official">{profile.officialName}</p>}
          {recognitionLabel && <span className="country-card__badge">{recognitionLabel}</span>}
        </div>
        <button className="country-card__close" onClick={() => selectCountry(null)} aria-label="Close">
          ×
        </button>
      </header>

      <div className="country-card__core-stats">
        <StatItem label="Population" stat={profile.statistics.population} format={(v) => formatCompact(v)} />
        <StatItem label="GDP" stat={profile.statistics.gdp} format={formatCurrencyCompact} />
        <StatItem label="Area" stat={profile.statistics.area} format={(v) => `${formatNumber(v)} km²`} />
        <div className="stat-item">
          <span className="stat-item__label">Government</span>
          <span className="stat-item__value">{profile.governmentType ?? 'Data unavailable'}</span>
          {profile.governmentType && <span className="stat-item__source">Wikidata</span>}
        </div>
      </div>

      {!expanded && (
        <button className="country-card__expand" onClick={() => setExpanded(true)}>
          Expand ↓
        </button>
      )}

      {expanded && (
        <div className="country-card__body scroll-thin">
          <Section title="Economy">
            {profile.hasDeepData ? (
              <div className="stat-grid">
                <StatItem label="GDP per capita" stat={profile.statistics.gdpPerCapita} format={formatCurrencyCompact} />
                <StatItem label="GDP growth" stat={profile.statistics.gdpGrowth} format={formatPercent} />
                <StatItem label="GDP (PPP)" stat={profile.statistics.gdpPpp} format={formatCurrencyCompact} />
                <StatItem label="Inflation" stat={profile.statistics.inflation} format={formatPercent} />
                <StatItem label="Unemployment" stat={profile.statistics.unemployment} format={formatPercent} />
                <div className="stat-item">
                  <span className="stat-item__label">Currency</span>
                  <span className="stat-item__value">{profile.currency ?? 'Data unavailable'}</span>
                </div>
              </div>
            ) : (
              <UnavailableNote />
            )}
          </Section>

          <Section title="Military">
            {profile.statistics.militaryExpenditure ? (
              <div className="stat-grid">
                <StatItem label="Military spending" stat={profile.statistics.militaryExpenditure} format={formatCurrencyCompact} />
                <StatItem label="% of GDP" stat={profile.statistics.militaryExpenditurePctGdp} format={formatPercent} />
              </div>
            ) : (
              <UnavailableNote />
            )}
          </Section>

          <Section title="Society">
            <div className="stat-grid">
              <StatItem label="Life expectancy" stat={profile.statistics.lifeExpectancy} format={(v) => `${formatNumber(v, { maximumFractionDigits: 1 })} yrs`} />
              <StatItem label="Literacy" stat={profile.statistics.literacyRate} format={formatPercent} />
              <div className="stat-item">
                <span className="stat-item__label">Languages</span>
                <span className="stat-item__value">{profile.languages.length ? profile.languages.join(', ') : 'Data unavailable'}</span>
              </div>
            </div>
          </Section>

          <Section title="Politics">
            {profile.hasDeepData ? (
              <div className="stat-grid">
                <div className="stat-item">
                  <span className="stat-item__label">Head of state</span>
                  <span className="stat-item__value">{profile.headOfState ?? 'Data unavailable'}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-item__label">Head of government</span>
                  <span className="stat-item__value">{profile.headOfGovernment ?? 'Data unavailable'}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-item__label">Independence / founding</span>
                  <span className="stat-item__value">{profile.independenceDate ?? 'Data unavailable'}</span>
                </div>
              </div>
            ) : (
              <UnavailableNote />
            )}
          </Section>

          <Section title="Geography">
            <div className="stat-grid">
              <div className="stat-item">
                <span className="stat-item__label">Capital</span>
                <span className="stat-item__value">{profile.capital ?? 'Data unavailable'}</span>
              </div>
              <div className="stat-item">
                <span className="stat-item__label">Region</span>
                <span className="stat-item__value">{profile.region}</span>
              </div>
              <div className="stat-item stat-item--wide">
                <span className="stat-item__label">Neighbors</span>
                <div className="neighbor-chips">
                  {profile.neighbors.length
                    ? profile.neighbors.map((n) => (
                        <button key={n} className="neighbor-chip" onClick={() => onSelectCountry(n)}>
                          {n}
                        </button>
                      ))
                    : 'None (island nation or no shared land border)'}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Relationships">
            <p className="section-hint">Show geopolitical relationship arcs on the globe for {profile.name}.</p>
            <LayerToggles />
            <button className="text-button" onClick={() => openCompare(profile.id)}>
              Compare with another country →
            </button>
          </Section>

          {countryEvents.length > 0 && (
            <Section title="History">
              <ul className="history-list">
                {countryEvents.map((e) => (
                  <li key={e.id}>
                    <span className="history-year">{e.date.slice(0, 4)}</span>
                    <span className="history-title">{e.title}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="News">
            <NewsList countryId={profile.id} />
          </Section>

          <button className="country-card__collapse" onClick={() => setExpanded(false)}>
            Collapse ↑
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="country-card__section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function UnavailableNote() {
  return <p className="section-hint">Extended data not yet available for this country.</p>;
}

function LayerToggles() {
  const active = useLayersStore((s) => s.active);
  const toggle = useLayersStore((s) => s.toggle);
  return (
    <div className="layer-toggles">
      {LAYER_OPTIONS.map((opt) => (
        <label key={opt.type} className="layer-toggle">
          <input type="checkbox" checked={active[opt.type]} onChange={() => toggle(opt.type)} />
          {opt.label}
        </label>
      ))}
    </div>
  );
}
