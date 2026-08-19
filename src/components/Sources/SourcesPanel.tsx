import './sources.css';

interface SourcesPanelProps {
  onClose: () => void;
}

export function SourcesPanel({ onClose }: SourcesPanelProps) {
  return (
    <div className="sources-overlay" onClick={onClose}>
      <div className="sources-panel" onClick={(e) => e.stopPropagation()}>
        <button className="sources-panel__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2>Sources & Methodology</h2>

        <section>
          <h3>Data sources</h3>
          <ul>
            <li>
              <strong>World Bank Open Data</strong> — population, GDP, GDP per capita, GDP growth, GDP (PPP), inflation,
              unemployment, military expenditure, life expectancy, and literacy. Values are the most recent figure the
              World Bank has published per country, which can be a different year for different countries and metrics —
              the year shown next to each figure is always the year it actually refers to, not the current year.
            </li>
            <li>
              <strong>Wikidata</strong> — country identity (capital, government type, heads of state/government,
              independence/founding date, official languages, currency, continent, and land borders). Wikidata is
              collaboratively edited; treat these fields as generally reliable but not authoritative in the way an
              official government register is, and expect political/leadership fields in particular to occasionally
              lag real-world changes.
            </li>
            <li>
              <strong>Natural Earth</strong> (via the <code>world-atlas</code> package) — country boundary geometry, at
              1:50m resolution. Public domain.
            </li>
            <li>
              <strong>GNews</strong> — current news headlines, fetched server-side and cached; never called directly
              from your browser.
            </li>
            <li>
              <strong>Wikipedia</strong> — used only for the curated historical-events timeline, as a transparent,
              widely cross-checked tertiary source. This is a deliberate v1 tradeoff, not a claim of primary-source
              historical scholarship.
            </li>
          </ul>
        </section>

        <section>
          <h3>Update frequency & caching</h3>
          <p>
            Country statistics and geometry are rebuilt from source APIs periodically and shipped as static data —
            they don't change on every page load. News is cached at the edge (roughly every 2 hours for global
            headlines, every 6 hours per country) to stay within free news-API limits while keeping things
            reasonably current.
          </p>
        </section>

        <section>
          <h3>Disputed & contested territories</h3>
          <p>
            Political borders are not universally agreed upon. This app distinguishes UN member states from UN
            observer states, partially recognized states, de facto independent territories, and disputed
            territories — shown as a small badge on the country card. Taiwan, Kosovo, Western Sahara, and
            Somaliland are treated explicitly as special cases rather than folded silently into a neighboring
            country's statistics. This is a simplification of genuinely complex, contested political realities,
            not a statement of political position.
          </p>
        </section>

        <section>
          <h3>Historical borders</h3>
          <p>
            This version shows present-day political borders only. Historical events reference the modern country
            considered their closest present-day equivalent (for example, events involving the German Empire are
            tagged to today's Germany) — the data model is designed to support real historical border geometry and
            historical statistics later, but none is fabricated or approximated in the meantime. Where historical
            data isn't available, the app says so explicitly rather than substituting current data.
          </p>
        </section>

        <section>
          <h3>No fake data</h3>
          <p>
            Every statistic, event, and relationship in this app is real and sourced — nothing is invented or
            estimated to fill gaps. Where a country lacks a field (a missing GDP figure, an unresolved head of
            state), the interface says "Data unavailable" instead of guessing.
          </p>
        </section>
      </div>
    </div>
  );
}
