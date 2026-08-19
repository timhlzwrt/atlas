/**
 * Orchestrates the full country dataset build: Wikidata (structural/political
 * facts) + World Bank (economic/demographic time series) + world-atlas
 * (geometry), merged into public/data/countries/*.json with every field
 * carrying an inline Source. Run via `npm run data:build`.
 */
import { fetchWikidataCountries, resolveLabels } from './fetch-wikidata';
import { fetchWorldBankIndicators, WORLD_BANK_INDICATORS } from './fetch-worldbank';
import { buildGeometry } from './build-geometry';
import { flagEmoji } from './lib/flag-emoji';
import { DEFAULT_RECOGNITION, RECOGNITION_OVERRIDES } from './curated/recognition';
import { SPECIAL_TERRITORIES } from './curated/special-territories';
import { writePublicData } from './lib/http';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { CountryProfile, CountryStatistics, Source, SourcedValue } from '../src/types/domain';

const WORLD_BANK_LABELS: Record<string, string> = {
  'SP.POP.TOTL': 'Population, total',
  'EN.POP.DNST': 'Population density',
  'AG.LND.TOTL.K2': 'Land area',
  'NY.GDP.MKTP.CD': 'GDP (current US$)',
  'NY.GDP.PCAP.CD': 'GDP per capita (current US$)',
  'NY.GDP.MKTP.KD.ZG': 'GDP growth (annual %)',
  'NY.GDP.MKTP.PP.CD': 'GDP, PPP (current international $)',
  'FP.CPI.TOTL.ZG': 'Inflation, consumer prices (annual %)',
  'SL.UEM.TOTL.ZS': 'Unemployment, total (% of labor force)',
  'MS.MIL.XPND.CD': 'Military expenditure (current US$)',
  'MS.MIL.XPND.GD.ZS': 'Military expenditure (% of GDP)',
  'SP.DYN.LE00.IN': 'Life expectancy at birth',
  'SE.ADT.LITR.ZS': 'Literacy rate, adult total',
};

function worldBankSource(code: string, iso2: string, year: string): Source {
  return {
    org: 'World Bank',
    dataset: WORLD_BANK_LABELS[code] ?? code,
    url: `https://data.worldbank.org/indicator/${code}?locations=${iso2}`,
    date: year,
  };
}

function wikidataSource(qid: string, retrievedAt: string): Source {
  return {
    org: 'Wikidata',
    dataset: `Wikidata item ${qid}`,
    url: `https://www.wikidata.org/wiki/${qid}`,
    date: retrievedAt,
  };
}

async function main() {
  console.log('Fetching Wikidata country facts...');
  const wikidata = await fetchWikidataCountries();
  const countries = Object.values(wikidata);

  const qids = new Set<string>();
  for (const c of countries) {
    if (c.capitalQid) qids.add(c.capitalQid);
    if (c.govFormQid) qids.add(c.govFormQid);
    if (c.hosQid) qids.add(c.hosQid);
    if (c.hogQid) qids.add(c.hogQid);
    if (c.currencyQid) qids.add(c.currencyQid);
    c.languageQids.forEach((q) => qids.add(q));
  }
  console.log(`Resolving ${qids.size} Wikidata labels...`);
  const labels = await resolveLabels(qids);

  console.log('Fetching World Bank indicators...');
  const worldBank = await fetchWorldBankIndicators();

  console.log('Building geometry...');
  const isoNumToIso2 = new Map<string, string>();
  for (const c of countries) {
    if (c.isoNum) isoNumToIso2.set(c.isoNum.padStart(3, '0'), c.iso2);
  }
  const geometry = buildGeometry(isoNumToIso2);
  if (geometry.unmatchedNumericIds.length) {
    console.warn('Unmatched geometry features (no country data will be shown):', geometry.unmatchedNumericIds);
  }

  const retrievedAt = new Date().toISOString().slice(0, 10);
  const iso2ByQid = new Map(countries.map((c) => [c.qid, c.iso2]));

  const profiles: CountryProfile[] = countries.map((c) => {
    const statistics: CountryStatistics = {};
    for (const { metric, code, unit } of WORLD_BANK_INDICATORS) {
      const row = c.iso3 ? worldBank[metric]?.[c.iso3] : undefined;
      if (!row) continue;
      const key = metric as keyof CountryStatistics;
      (statistics as Record<string, SourcedValue<number>>)[key] = {
        value: row.value,
        unit,
        source: worldBankSource(code, c.iso2, row.year),
        retrievedAt,
      };
    }

    const neighbors = c.neighborQids.map((q) => iso2ByQid.get(q)).filter((v): v is string => Boolean(v));

    const sources: Source[] = [];
    if (c.qid) sources.push(wikidataSource(c.qid, retrievedAt));
    for (const v of Object.values(statistics)) {
      if (v) sources.push((v as SourcedValue<number>).source);
    }

    const governmentType = c.govFormQid ? labels[c.govFormQid] : undefined;
    const headOfState = c.hosQid ? labels[c.hosQid] : undefined;

    return {
      id: c.iso2,
      iso3: c.iso3 ?? '',
      name: c.name,
      officialName: c.officialName ?? c.name,
      region: c.continent ?? 'Unknown',
      capital: c.capitalQid ? labels[c.capitalQid] : undefined,
      flagEmoji: flagEmoji(c.iso2),
      recognitionStatus: RECOGNITION_OVERRIDES[c.iso2] ?? DEFAULT_RECOGNITION,
      hasDeepData: Boolean(governmentType && headOfState && statistics.gdp),
      languages: c.languageQids.map((q) => labels[q]).filter((v): v is string => Boolean(v)),
      currency: c.currencyQid ? labels[c.currencyQid] : undefined,
      governmentType,
      headOfState,
      headOfGovernment: c.hogQid ? labels[c.hogQid] : undefined,
      independenceDate: c.inception?.slice(0, 10),
      neighbors,
      borders: neighbors,
      statistics,
      sources,
    };
  });

  for (const special of SPECIAL_TERRITORIES) profiles.push(special);

  // Only keep countries we actually have geometry for, so the globe and the
  // country data stay in lockstep (no info card for a country with no shape).
  const geometryIds = new Set(geometry.featureCollection.features.map((f) => f.properties.id));
  const finalProfiles = profiles.filter((p) => geometryIds.has(p.id));
  const skipped = profiles.filter((p) => !geometryIds.has(p.id));
  if (skipped.length) {
    console.warn(
      `Skipping ${skipped.length} countries with no matching geometry: ${skipped.map((p) => p.id).join(', ')}`,
    );
  }

  for (const profile of finalProfiles) {
    await writePublicData(`countries/${profile.id}.json`, profile);
  }

  const index = finalProfiles
    .map((p) => ({
      id: p.id,
      name: p.name,
      officialName: p.officialName,
      region: p.region,
      flagEmoji: p.flagEmoji,
      hasDeepData: p.hasDeepData,
      recognitionStatus: p.recognitionStatus,
      centroid: geometry.centroids[p.id] ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  await writePublicData('countries/index.json', index);

  await writePublicData('geometry/world.json', geometry.featureCollection);

  // Codegen a tiny iso2 -> name lookup for the news Pages Function, so it can
  // build a sensible search query without an extra runtime fetch. Single
  // source of truth stays this pipeline; the function just consumes it.
  const namesMap = Object.fromEntries(finalProfiles.map((p) => [p.id, p.name]));
  const namesFilePath = path.resolve(import.meta.dirname, '../functions/api/news/_country-names.generated.ts');
  await mkdir(path.dirname(namesFilePath), { recursive: true });
  await writeFile(
    namesFilePath,
    `// Generated by data-pipeline/build-countries.ts — do not edit by hand.\nexport const COUNTRY_NAMES: Record<string, string> = ${JSON.stringify(namesMap, null, 2)};\n`,
    'utf-8',
  );
  console.log('wrote functions/api/news/_country-names.generated.ts');

  console.log(`\nDone: ${finalProfiles.length} countries, ${finalProfiles.filter((p) => p.hasDeepData).length} with deep data.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
