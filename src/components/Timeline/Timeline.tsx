import { useEffect, useMemo, useState } from 'react';
import { ATLAS_START_YEAR, useTimeStore } from '../../state/timeStore';
import { fetchPoliticalHistory } from '../../lib/api';
import type { GeoEvent, PoliticalHistory, Source } from '../../types/domain';
import './timeline.css';

interface TimelineProps {
  events: GeoEvent[];
  selectedCountryId: string | null;
  selectedCountryName: string | null;
}

/** Everything the timeline can plot, whether it came from the curated events or the leadership record. */
interface TimelineItem {
  id: string;
  kind: 'event' | 'term' | 'election';
  title: string;
  subtitle?: string;
  date: string;
  endDate?: string;
  description?: string;
  importance: 1 | 2 | 3;
  sources: Source[];
}

const MARKER_LANES = 3;
/** Minimum horizontal separation (in % of track width) before markers get pushed to another lane. */
const LANE_GAP = 1.6;

export function Timeline({ events, selectedCountryId, selectedCountryName }: TimelineProps) {
  const mode = useTimeStore((s) => s.mode);
  const selectedEventId = useTimeStore((s) => s.selectedEventId);
  const timelineScope = useTimeStore((s) => s.timelineScope);
  const setTimelineScope = useTimeStore((s) => s.setTimelineScope);
  const selectEvent = useTimeStore((s) => s.selectEvent);
  const goToPresent = useTimeStore((s) => s.goToPresent);
  const showPolitics = useTimeStore((s) => s.showPolitics);
  const setShowPolitics = useTimeStore((s) => s.setShowPolitics);
  const [openItem, setOpenItem] = useState<TimelineItem | null>(null);
  const [politics, setPolitics] = useState<PoliticalHistory | null>(null);

  const nowYear = new Date().getFullYear();
  const countryScope = timelineScope === 'country' && Boolean(selectedCountryId);

  useEffect(() => {
    if (!selectedCountryId) {
      setPolitics(null);
      return;
    }
    let active = true;
    fetchPoliticalHistory(selectedCountryId).then((history) => {
      if (active) setPolitics(history);
    });
    return () => {
      active = false;
    };
  }, [selectedCountryId]);

  useEffect(() => setOpenItem(null), [selectedCountryId, timelineScope]);

  const items = useMemo<TimelineItem[]>(() => {
    const source = countryScope
      ? events.filter((e) => e.countries.includes(selectedCountryId!))
      : events;
    const list: TimelineItem[] = source.map((e) => ({
      id: e.id,
      kind: 'event',
      title: e.title,
      date: e.date,
      endDate: e.endDate,
      description: e.description,
      importance: e.importance,
      sources: e.sources,
    }));

    // The leadership record is per-country and far denser than the world
    // events, so it only joins the track in country scope.
    if (countryScope && showPolitics && politics) {
      for (const term of politics.terms) {
        if (!term.start) continue;
        const wonAt = term.elections.map((e) => e.label).join(', ');
        list.push({
          id: `term-${term.id}`,
          kind: 'term',
          title: term.person,
          subtitle: term.office,
          date: term.start,
          endDate: term.end,
          description: [
            `Took office as ${term.office}${term.party ? ` for the ${term.party}` : ''}.`,
            wonAt ? `Elected in: ${wonAt}.` : '',
          ]
            .filter(Boolean)
            .join(' '),
          importance: term.role === 'head-of-government' ? 2 : 1,
          sources: politics.sources,
        });
      }
      for (const election of politics.elections) {
        list.push({
          id: `election-${election.id}`,
          kind: 'election',
          title: election.label,
          subtitle: 'Election',
          date: election.date,
          importance: 2,
          sources: politics.sources,
        });
      }
    }

    return list.sort((a, b) => a.date.localeCompare(b.date));
  }, [events, countryScope, selectedCountryId, showPolitics, politics]);

  /**
   * Lay markers into a few stacked lanes: at ~115 world events (and far more
   * once a country's leadership record joins in) a single row is an unreadable
   * smear, so anything landing within LANE_GAP of its neighbour steps up a row.
   */
  const track = useMemo(() => {
    const span = nowYear - ATLAS_START_YEAR;
    const laneEnds = new Array(MARKER_LANES).fill(-Infinity);
    return items.map((item) => {
      const year = Number(item.date.slice(0, 4));
      const pct = Math.min(100, Math.max(0, ((year - ATLAS_START_YEAR) / span) * 100));
      let lane = laneEnds.findIndex((end) => pct - end >= LANE_GAP);
      if (lane === -1) lane = laneEnds.indexOf(Math.min(...laneEnds));
      laneEnds[lane] = pct;
      return { item, pct, lane };
    });
  }, [items, nowYear]);

  const decades = useMemo(() => {
    const span = nowYear - ATLAS_START_YEAR;
    const marks: { year: number; pct: number }[] = [];
    for (let year = 1950; year <= nowYear; year += 10) {
      marks.push({ year, pct: ((year - ATLAS_START_YEAR) / span) * 100 });
    }
    return marks;
  }, [nowYear]);

  const politicsCount = politics ? politics.terms.length + politics.elections.length : 0;

  return (
    <div className="timeline">
      {openItem && (
        <div className="timeline__popover">
          <button className="timeline__popover-close" onClick={() => setOpenItem(null)}>
            ×
          </button>
          {openItem.subtitle && <p className="timeline__popover-kicker">{openItem.subtitle}</p>}
          <h4>{openItem.title}</h4>
          <p className="timeline__popover-date">
            {formatEventDate(openItem.date)}
            {openItem.endDate ? ` – ${formatEventDate(openItem.endDate)}` : openItem.kind === 'term' ? ' – present' : ''}
          </p>
          {openItem.description && <p className="timeline__popover-desc">{openItem.description}</p>}
          <div className="timeline__popover-sources">
            {openItem.sources.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener">
                {s.org}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="timeline__header">
        {selectedCountryName ? (
          <div className="timeline__scope-toggle">
            <button className={timelineScope === 'world' ? 'active' : ''} onClick={() => setTimelineScope('world')}>
              World
            </button>
            <button className={timelineScope === 'country' ? 'active' : ''} onClick={() => setTimelineScope('country')}>
              {selectedCountryName}
            </button>
          </div>
        ) : (
          <span className="timeline__label">World timeline · since {ATLAS_START_YEAR}</span>
        )}

        <div className="timeline__header-right">
          {countryScope && politicsCount > 0 && (
            <label className="timeline__politics-toggle">
              <input type="checkbox" checked={showPolitics} onChange={() => setShowPolitics(!showPolitics)} />
              Leaders &amp; elections ({politicsCount})
            </label>
          )}
          {mode === 'historical' && (
            <button className="timeline__present-btn" onClick={goToPresent}>
              ← Return to present
            </button>
          )}
        </div>
      </div>

      <div className="timeline__track">
        <div className="timeline__line" />
        {decades.map(({ year, pct }) => (
          <div key={year} className="timeline__tick" style={{ left: `${pct}%` }} aria-hidden="true" />
        ))}
        {track.map(({ item, pct, lane }) => (
          <button
            key={item.id}
            className={`timeline__marker timeline__marker--${item.kind} timeline__marker--imp${item.importance} ${
              selectedEventId === item.id ? 'timeline__marker--active' : ''
            }`}
            style={{ left: `${pct}%`, top: `${18 + lane * 13}px` }}
            title={`${item.title} (${item.date.slice(0, 4)})`}
            onClick={() => {
              selectEvent(item.id, item.date);
              setOpenItem(item);
            }}
          />
        ))}
        <div className="timeline__now" style={{ left: '100%' }} title="Present day" />
      </div>
      <div className="timeline__axis">
        <span>{ATLAS_START_YEAR}</span>
        {decades.slice(0, -1).map(({ year, pct }) => (
          <span key={year} className="timeline__axis-mark" style={{ left: `${pct}%` }}>
            {year}
          </span>
        ))}
        <span className="timeline__axis-now">{nowYear}</span>
      </div>
    </div>
  );
}

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
