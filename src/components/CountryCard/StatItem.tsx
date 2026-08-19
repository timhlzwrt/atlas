import type { SourcedValue } from '../../types/domain';

interface StatItemProps {
  label: string;
  stat?: SourcedValue<number>;
  format: (value: number) => string;
}

/** A single labeled statistic with its source inline underneath — never shown without provenance. */
export function StatItem({ label, stat, format }: StatItemProps) {
  if (!stat) {
    return (
      <div className="stat-item stat-item--empty">
        <span className="stat-item__label">{label}</span>
        <span className="stat-item__unavailable">Data unavailable</span>
      </div>
    );
  }
  return (
    <div className="stat-item">
      <span className="stat-item__label">{label}</span>
      <span className="stat-item__value">{format(stat.value)}</span>
      <a
        className="stat-item__source"
        href={stat.source.url}
        target="_blank"
        rel="noreferrer noopener"
        title={`${stat.source.dataset} — ${stat.source.org}`}
      >
        {stat.source.org} · {stat.source.date}
      </a>
    </div>
  );
}
