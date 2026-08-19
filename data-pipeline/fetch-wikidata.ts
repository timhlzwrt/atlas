/**
 * Pulls structural/political facts about sovereign states from Wikidata.
 *
 * Split into several small queries (one property group each) rather than one
 * large joined query: Wikidata Query Service's planner reliably stack-overflows
 * on queries with more than ~3 OPTIONAL blocks combined with GROUP BY/SAMPLE.
 * Small queries are also easier to reason about and cache independently.
 */
import { qidFromUri, sparql } from './lib/http';

const COUNTRY_FILTER = `
  ?country wdt:P297 ?iso2 .
  ?country wdt:P31 ?type . FILTER(?type IN (wd:Q3624078, wd:Q6256))
  FILTER NOT EXISTS { ?country wdt:P576 ?dissolved . }
`;

function singleValueQuery(cacheKey: string, prop: string, varName: string) {
  return sparql(
    `SELECT ?country ?iso2 (SAMPLE(?${varName}) AS ?${varName}) WHERE {
      ${COUNTRY_FILTER}
      OPTIONAL { ?country wdt:${prop} ?${varName} . }
    } GROUP BY ?country ?iso2`,
    cacheKey,
  );
}

export interface WikidataCountry {
  iso2: string;
  iso3?: string;
  isoNum?: string;
  qid: string;
  name: string;
  officialName?: string;
  capitalQid?: string;
  inception?: string;
  govFormQid?: string;
  hosQid?: string;
  hogQid?: string;
  currencyQid?: string;
  languageQids: string[];
  continent?: string;
  neighborQids: string[];
}

export async function fetchWikidataCountries(): Promise<Record<string, WikidataCountry>> {
  const [ids, names, officialNames, capitals, inceptions, govForms, hos, hog, currencies, langs, continents, neighborRows] =
    await Promise.all([
      sparql(
        `SELECT ?country ?iso2 (SAMPLE(?iso3) AS ?iso3) (SAMPLE(?isoNum) AS ?isoNum) WHERE {
          ${COUNTRY_FILTER}
          OPTIONAL { ?country wdt:P298 ?iso3 . }
          OPTIONAL { ?country wdt:P299 ?isoNum . }
        } GROUP BY ?country ?iso2`,
        'ids',
      ),
      sparql(
        `SELECT ?country ?iso2 ?countryLabel WHERE {
          ${COUNTRY_FILTER}
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,de,fr,es". }
        }`,
        'names',
      ),
      sparql(
        `SELECT ?country ?iso2 ?officialName WHERE {
          ${COUNTRY_FILTER}
          OPTIONAL { ?country wdt:P1448 ?officialName . FILTER(LANG(?officialName)="en") }
        }`,
        'official-names',
      ),
      singleValueQuery('capitals', 'P36', 'capital'),
      sparql(
        `SELECT ?country ?iso2 (SAMPLE(?inception) AS ?inception) WHERE {
          ${COUNTRY_FILTER}
          OPTIONAL { ?country wdt:P571 ?inception . }
        } GROUP BY ?country ?iso2`,
        'inceptions',
      ),
      singleValueQuery('gov-forms', 'P122', 'govForm'),
      singleValueQuery('hos', 'P35', 'hos'),
      singleValueQuery('hog', 'P6', 'hog'),
      singleValueQuery('currencies', 'P38', 'currency'),
      sparql(
        `SELECT ?country ?iso2 (GROUP_CONCAT(DISTINCT ?lang; separator="|") AS ?langs) WHERE {
          ${COUNTRY_FILTER}
          OPTIONAL { ?country wdt:P37 ?lang . }
        } GROUP BY ?country ?iso2`,
        'languages',
      ),
      sparql(
        `SELECT ?country ?iso2 (SAMPLE(?continentLabel) AS ?continent) WHERE {
          ${COUNTRY_FILTER}
          OPTIONAL { ?country wdt:P30 ?continent . ?continent rdfs:label ?continentLabel . FILTER(LANG(?continentLabel)="en") }
        } GROUP BY ?country ?iso2`,
        'continents',
      ),
      sparql(
        `SELECT ?country ?iso2 (GROUP_CONCAT(DISTINCT ?neighbor; separator="|") AS ?neighbors) WHERE {
          ${COUNTRY_FILTER}
          OPTIONAL { ?country wdt:P47 ?neighbor . }
        } GROUP BY ?country ?iso2`,
        'neighbors',
      ),
    ]);

  const byIso2 = new Map<string, WikidataCountry>();
  const ensure = (iso2: string, qid: string): WikidataCountry => {
    let entry = byIso2.get(iso2);
    if (!entry) {
      entry = { iso2, qid, name: iso2, languageQids: [], neighborQids: [] };
      byIso2.set(iso2, entry);
    }
    return entry;
  };

  for (const row of ids) {
    const e = ensure(row.iso2.value, qidFromUri(row.country.value)!);
    e.iso3 = row.iso3?.value;
    e.isoNum = row.isoNum?.value;
  }
  for (const row of names) {
    const e = ensure(row.iso2.value, qidFromUri(row.country.value)!);
    if (row.countryLabel) e.name = row.countryLabel.value;
  }
  for (const row of officialNames) {
    if (!row.officialName) continue;
    const e = byIso2.get(row.iso2.value);
    if (e && !e.officialName) e.officialName = row.officialName.value;
  }
  for (const row of capitals) {
    const e = byIso2.get(row.iso2.value);
    if (e) e.capitalQid = qidFromUri(row.capital?.value);
  }
  for (const row of inceptions) {
    const e = byIso2.get(row.iso2.value);
    if (e && row.inception) e.inception = row.inception.value;
  }
  for (const row of govForms) {
    const e = byIso2.get(row.iso2.value);
    if (e) e.govFormQid = qidFromUri(row.govForm?.value);
  }
  for (const row of hos) {
    const e = byIso2.get(row.iso2.value);
    if (e) e.hosQid = qidFromUri(row.hos?.value);
  }
  for (const row of hog) {
    const e = byIso2.get(row.iso2.value);
    if (e) e.hogQid = qidFromUri(row.hog?.value);
  }
  for (const row of currencies) {
    const e = byIso2.get(row.iso2.value);
    if (e) e.currencyQid = qidFromUri(row.currency?.value);
  }
  for (const row of langs) {
    const e = byIso2.get(row.iso2.value);
    if (e && row.langs?.value) {
      e.languageQids = row.langs.value
        .split('|')
        .map((uri) => qidFromUri(uri))
        .filter((v): v is string => Boolean(v));
    }
  }
  for (const row of continents) {
    const e = byIso2.get(row.iso2.value);
    if (e && row.continent) e.continent = row.continent.value;
  }
  for (const row of neighborRows) {
    const e = byIso2.get(row.iso2.value);
    if (e && row.neighbors?.value) {
      e.neighborQids = row.neighbors.value
        .split('|')
        .map((uri) => qidFromUri(uri))
        .filter((v): v is string => Boolean(v));
    }
  }

  return Object.fromEntries(byIso2);
}

/** Resolve a set of Wikidata QIDs to English labels, batched to stay within safe query size. */
export async function resolveLabels(qids: Set<string>): Promise<Record<string, string>> {
  const list = [...qids].filter(Boolean);
  const labels: Record<string, string> = {};
  const batchSize = 250;
  for (let i = 0; i < list.length; i += batchSize) {
    const batch = list.slice(i, i + batchSize);
    const values = batch.map((q) => `wd:${q}`).join(' ');
    const rows = await sparql(
      `SELECT ?item ?itemLabel WHERE {
        VALUES ?item { ${values} }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,de,fr,es". }
      }`,
      `labels-${i}`,
    );
    for (const row of rows) {
      const qid = qidFromUri(row.item.value);
      if (qid && row.itemLabel) labels[qid] = row.itemLabel.value;
    }
  }
  return labels;
}
