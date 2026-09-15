import { useEffect, useMemo, useState } from 'react';
import { ATLAS_START_YEAR, useTimeStore } from '../../state/timeStore';
import { fetchPoliticalHistory } from '../../lib/api';
import type { EventCategory, GeoEvent, PoliticalHistory, Source } from '../../types/domain';
import './timeline.css';

interface TimelineProps {
  events: GeoEvent[];
  selectedCountryId: string | null;
  selectedCountryName: string | null;
}

/** The four visual tones markers/popovers are painted in — reuses the app's existing semantic colors
 *  (see tokens.css) rather than inventing a chart-specific palette. */
type Tone = 'conflict' | 'positive' | 'accent' | 'warning' | 'neutral';

/** Buckets every curated event category into one of the four tones, and gives it a display label
 *  for the marker tooltip and popover kicker. Record<EventCategory, ...> so a newly added category
 *  fails to compile here instead of silently rendering uncategorized. */
const CATEGORY_META: Record<EventCategory, { label: string; tone: Tone }> = {
  war: { label: 'War', tone: 'conflict' },
  revolution: { label: 'Revolution', tone: 'conflict' },
  'regime-change': { label: 'Regime change', tone: 'conflict' },
  dissolution: { label: 'Dissolution', tone: 'conflict' },
  independence: { label: 'Independence', tone: 'positive' },
  formation: { label: 'Formation', tone: 'positive' },
  treaty: { label: 'Treaty', tone: 'accent' },
  diplomatic: { label: 'Diplomatic', tone: 'accent' },
  organization: { label: 'Organization', tone: 'accent' },
  political: { label: 'Political', tone: 'accent' },
  economic: { label: 'Economic', tone: 'warning' },
};

const LEGEND: { tone: Tone; label: string }[] = [
  { tone: 'conflict', label: 'Conflict & upheaval' },
  { tone: 'positive', label: 'Founding' },
  { tone: 'accent', label: 'Diplomacy & politics' },
  { tone: 'warning', label: 'Economic' },
];

/** Everything the timeline can plot, whether it came from the curated events or the leadership record. */
interface TimelineItem {
  id: string;
  kind: 'event' | 'term' | 'election';
  title: string;
  subtitle?: string;
  tone: Tone;
  date: string;
  endDate?: string;
  description?: string;
  importance: 1 | 2 | 3;
  sources: Source[];
}

const MARKER_LANES = 3;
/** Minimum horizontal separation (in % of track width) before markers get pushed to another lane. */
const LANE_GAP = 1.6;
/** Cap on marker entrance stagger so a country with a dense leadership record doesn't take forever to settle. */
const MAX_STAGGER_MS = 180;

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
    fetchPoliticalHistory(selectedCountryId)
      .then((history) => {
        if (active) setPolitics(history);
      })
      .catch(() => {
        // A non-404 failure just leaves the timeline without leadership markers.
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
      subtitle: CATEGORY_META[e.category].label,
      tone: CATEGORY_META[e.category].tone,
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
          tone: term.role === 'head-of-government' ? 'positive' : 'neutral',
          date: term.start,
          endDate: term.end,
          description: [
            `Took office as ${term.office}${term.party ? ` for the ${term.party}` : ''}.`,
            wonAt ? `Elected in: ${wonAt}.` : '',
          ]
            .filter(Boolean)
            .join(' '),
          importance: term.role === 'head-of-government' ? 2 : 1,
          // Falls back to the country's aggregate source list on data
          // generated before per-term sourcing existed (source is optional
          // until `npm run data:politics` backfills it everywhere).
          sources: term.source ? [term.source] : politics.sources,
        });
      }
      for (const election of politics.elections) {
        list.push({
          id: `election-${election.id}`,
          kind: 'election',
          title: election.label,
          subtitle: 'Election',
          tone: 'accent',
          date: election.date,
          importance: 2,
          sources: election.source ? [election.source] : politics.sources,
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
        <div className={`timeline__popover timeline__popover--tone-${openItem.tone}`}>
          <button className="timeline__popover-close" onClick={() => setOpenItem(null)} aria-label="Close">
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

      <div className="timeline__legend" aria-hidden="true">
        {LEGEND.map(({ tone, label }) => (
          <span key={tone} className="timeline__legend-item">
            <span className={`timeline__legend-dot timeline__marker--tone-${tone}`} />
            {label}
          </span>
        ))}
      </div>

      <div className="timeline__track">
        <div className="timeline__line" />
        {decades.map(({ year, pct }) => (
          <div key={year} className="timeline__tick" style={{ left: `${pct}%` }} aria-hidden="true" />
        ))}
        {track.map(({ item, pct, lane }, i) => (
          <button
            key={item.id}
            className={`timeline__marker timeline__marker--${item.kind} timeline__marker--tone-${item.tone} timeline__marker--imp${item.importance} ${
              selectedEventId === item.id ? 'timeline__marker--active' : ''
            }`}
            style={{ left: `${pct}%`, top: `${18 + lane * 14}px`, animationDelay: `${Math.min(i * 5, MAX_STAGGER_MS)}ms` }}
            title={`${item.title} — ${item.subtitle ?? ''} (${item.date.slice(0, 4)})`}
            onClick={() => {
              selectEvent(item.id, item.date);
              setOpenItem(item);
            }}
          />
        ))}
        <div className="timeline__now" title="Present day">
          <span className="timeline__now-pulse" />
        </div>
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
