import { useMemo, useRef, useState } from 'react';
import type { CountryIndexEntry } from '../../lib/api';
import './search.css';

interface SearchProps {
  countries: CountryIndexEntry[];
  onSelect: (id: string) => void;
}

export function Search({ countries, onSelect }: SearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return countries
      .filter((c) => c.name.toLowerCase().includes(q) || c.officialName.toLowerCase().includes(q) || c.id.toLowerCase() === q)
      .slice(0, 8);
  }, [query, countries]);

  const pick = (id: string) => {
    onSelect(id);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="search">
      <input
        ref={inputRef}
        type="text"
        placeholder="Search countries…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && results[0]) pick(results[0].id);
          if (e.key === 'Escape') inputRef.current?.blur();
        }}
        aria-label="Search countries"
      />
      {open && results.length > 0 && (
        <ul className="search__results">
          {results.map((c) => (
            <li key={c.id}>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => pick(c.id)}>
                <span className="search__flag">{c.flagEmoji}</span>
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
