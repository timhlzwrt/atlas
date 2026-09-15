import { useEffect, useState } from 'react';
import { useSelectionStore } from '../../state/selectionStore';
import { fetchCountry } from '../../lib/api';
import type { CountryIndexEntry } from '../../lib/api';
import type { CountryProfile, SourcedValue } from '../../types/domain';
import { formatCompact, formatCurrencyCompact, formatNumber, formatPercent } from '../CountryCard/formatters';
import './compare.css';

interface CompareProps {
  countries: CountryIndexEntry[];
}

const ROWS: { label: string; key: keyof CountryProfile['statistics']; format: (v: number) => string }[] = [
  { label: 'Population', key: 'population', format: (v) => formatCompact(v) },
  { label: 'Area', key: 'area', format: (v) => `${formatNumber(v)} km²` },
  { label: 'GDP', key: 'gdp', format: formatCurrencyCompact },
  { label: 'GDP per capita', key: 'gdpPerCapita', format: formatCurrencyCompact },
  { label: 'GDP growth', key: 'gdpGrowth', format: formatPercent },
  { label: 'Military spending', key: 'militaryExpenditure', format: formatCurrencyCompact },
  { label: 'Military % of GDP', key: 'militaryExpenditurePctGdp', format: formatPercent },
  { label: 'Life expectancy', key: 'lifeExpectancy', format: (v) => `${formatNumber(v, { maximumFractionDigits: 1 })} yrs` },
];

export function Compare({ countries }: CompareProps) {
  const open = useSelectionStore((s) => s.compareOpen);
  const [idA, idB] = useSelectionStore((s) => s.compareCountryIds);
  const setCompareCountry = useSelectionStore((s) => s.setCompareCountry);
  const closeCompare = useSelectionStore((s) => s.closeCompare);

  const [profileA, setProfileA] = useState<CountryProfile | null>(null);
  const [profileB, setProfileB] = useState<CountryProfile | null>(null);
  const [errorA, setErrorA] = useState(false);
  const [errorB, setErrorB] = useState(false);

  useEffect(() => {
    if (!idA) {
      setProfileA(null);
      setErrorA(false);
      return;
    }
    let active = true;
    setErrorA(false);
    fetchCountry(idA)
      .then((p) => {
        if (active) setProfileA(p);
      })
      .catch(() => {
        if (active) setErrorA(true);
      });
    return () => {
      active = false;
    };
  }, [idA]);
  useEffect(() => {
    if (!idB) {
      setProfileB(null);
      setErrorB(false);
      return;
    }
    let active = true;
    setErrorB(false);
    fetchCountry(idB)
      .then((p) => {
        if (active) setProfileB(p);
      })
      .catch(() => {
        if (active) setErrorB(true);
      });
    return () => {
      active = false;
    };
  }, [idB]);

  if (!open) return null;

  return (
    <div className="compare-overlay" onClick={closeCompare}>
      <div className="compare-panel" onClick={(e) => e.stopPropagation()}>
        <button className="compare-panel__close" onClick={closeCompare} aria-label="Close comparison">
          ×
        </button>
        <h2>Compare Countries</h2>
        <div className="compare-panel__pickers">
          <CountryPicker countries={countries} value={idA} onChange={(id) => setCompareCountry(0, id)} />
          <span className="compare-panel__vs">vs</span>
          <CountryPicker countries={countries} value={idB} onChange={(id) => setCompareCountry(1, id)} />
        </div>

        {profileA && profileB ? (
          <table className="compare-table">
            <thead>
              <tr>
                <th />
                <th>
                  {profileA.flagEmoji} {profileA.name}
                </th>
                <th>
                  {profileB.flagEmoji} {profileB.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const a = profileA.statistics[row.key] as SourcedValue<number> | undefined;
                const b = profileB.statistics[row.key] as SourcedValue<number> | undefined;
                return (
                  <tr key={row.label}>
                    <td className="compare-table__label">{row.label}</td>
                    <td>{a ? row.format(a.value) : '—'}</td>
                    <td>{b ? row.format(b.value) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : errorA || errorB ? (
          <p className="section-hint">Couldn't load one of these countries. Try picking again.</p>
        ) : (
          <p className="section-hint">Pick two countries to compare.</p>
        )}
      </div>
    </div>
  );
}

function CountryPicker({
  countries,
  value,
  onChange,
}: {
  countries: CountryIndexEntry[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        Select a country
      </option>
      {countries.map((c) => (
        <option key={c.id} value={c.id}>
          {c.flagEmoji} {c.name}
        </option>
      ))}
    </select>
  );
}
