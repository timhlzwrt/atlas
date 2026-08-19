import { useMemo, useState } from 'react';
import { useTimeStore } from '../../state/timeStore';
import type { GeoEvent } from '../../types/domain';
import './timeline.css';

interface TimelineProps {
  events: GeoEvent[];
  selectedCountryId: string | null;
  selectedCountryName: string | null;
}

const MIN_YEAR = 1800;

export function Timeline({ events, selectedCountryId, selectedCountryName }: TimelineProps) {
  const mode = useTimeStore((s) => s.mode);
  const selectedEventId = useTimeStore((s) => s.selectedEventId);
  const timelineScope = useTimeStore((s) => s.timelineScope);
  const setTimelineScope = useTimeStore((s) => s.setTimelineScope);
  const selectEvent = useTimeStore((s) => s.selectEvent);
  const goToPresent = useTimeStore((s) => s.goToPresent);
  const [openEvent, setOpenEvent] = useState<GeoEvent | null>(null);

  const nowYear = new Date().getFullYear();

  const visibleEvents = useMemo(() => {
    if (timelineScope === 'country' && selectedCountryId) {
      return events.filter((e) => e.countries.includes(selectedCountryId));
    }
    return events;
  }, [events, timelineScope, selectedCountryId]);

  const track = useMemo(() => {
    const span = nowYear - MIN_YEAR;
    return visibleEvents.map((e) => {
      const year = Number(e.date.slice(0, 4));
      const pct = Math.min(100, Math.max(0, ((year - MIN_YEAR) / span) * 100));
      return { event: e, pct };
    });
  }, [visibleEvents, nowYear]);

  return (
    <div className="timeline">
      {openEvent && (
        <div className="timeline__popover">
          <button className="timeline__popover-close" onClick={() => setOpenEvent(null)}>
            ×
          </button>
          <h4>{openEvent.title}</h4>
          <p className="timeline__popover-date">
            {formatEventDate(openEvent.date)}
            {openEvent.endDate ? ` – ${formatEventDate(openEvent.endDate)}` : ''}
          </p>
          <p className="timeline__popover-desc">{openEvent.description}</p>
          <div className="timeline__popover-sources">
            {openEvent.sources.map((s) => (
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
          <span className="timeline__label">World timeline</span>
        )}
        {mode === 'historical' && (
          <button className="timeline__present-btn" onClick={goToPresent}>
            ← Return to present
          </button>
        )}
      </div>

      <div className="timeline__track">
        <div className="timeline__line" />
        {track.map(({ event, pct }) => (
          <button
            key={event.id}
            className={`timeline__marker timeline__marker--imp${event.importance} ${selectedEventId === event.id ? 'timeline__marker--active' : ''}`}
            style={{ left: `${pct}%` }}
            title={`${event.title} (${event.date.slice(0, 4)})`}
            onClick={() => {
              selectEvent(event.id, event.date);
              setOpenEvent(event);
            }}
          />
        ))}
        <div className="timeline__now" style={{ left: '100%' }} title="Present day" />
      </div>
      <div className="timeline__axis">
        <span>{MIN_YEAR}</span>
        <span>{nowYear}</span>
      </div>
    </div>
  );
}

function formatEventDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
