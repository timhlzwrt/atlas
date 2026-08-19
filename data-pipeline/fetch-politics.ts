/**
 * Pulls the post-1945 political record for every country from Wikidata:
 * every head-of-state and head-of-government term, the party the officeholder
 * belonged to at the time, and the election that put them there.
 *
 * Same query-shape discipline as fetch-wikidata.ts — WDQS falls over on
 * unbounded class walks (`?type wdt:P279* wd:Q40231`), so every query here is
 * anchored on an explicit VALUES set and batched into small chunks.
 */
import { qidFromUri, sparql } from './lib/http';

export const POLITICS_SINCE_YEAR = 1945;

export type OfficeRole = 'head-of-state' | 'head-of-government';

export interface RawTerm {
  iso2: string;
  role: OfficeRole;
  officeQid: string;
  office: string;
  personQid: string;
  person: string;
  start?: string;
  end?: string;
  electionQids: string[];
}

export interface RawElection {
  qid: string;
  label: string;
  date: string;
}

export interface PartyMembership {
  personQid: string;
  party: string;
  start?: string;
  end?: string;
}

const COUNTRY_FILTER = `
  ?country wdt:P297 ?iso2 .
  ?country wdt:P31 ?ctype . FILTER(?ctype IN (wd:Q3624078, wd:Q6256))
  FILTER NOT EXISTS { ?country wdt:P576 ?dissolved . }
`;

/** P1906 = office held by head of state, P1313 = office held by head of government. */
const OFFICE_PROPS: Record<OfficeRole, string> = {
  'head-of-state': 'P1906',
  'head-of-government': 'P1313',
};

interface OfficeRow {
  iso2: string;
  role: OfficeRole;
  qid: string;
}

async function fetchOffices(): Promise<OfficeRow[]> {
  const offices: OfficeRow[] = [];
  for (const [role, prop] of Object.entries(OFFICE_PROPS) as [OfficeRole, string][]) {
    const rows = await sparql(
      `SELECT ?iso2 ?office WHERE {
        ${COUNTRY_FILTER}
        ?country wdt:${prop} ?office .
      }`,
      `politics-offices-${prop}`,
    );
    for (const row of rows) {
      const qid = qidFromUri(row.office.value);
      if (qid) offices.push({ iso2: row.iso2.value, role, qid });
    }
  }
  return offices;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Terms are keyed by (office, person, start): Wikidata models a re-elected
 * leader as one statement with several `elected in` qualifiers, which the
 * SPARQL result flattens into one row per election.
 */
async function fetchTerms(offices: OfficeRow[]): Promise<RawTerm[]> {
  const byQid = new Map<string, OfficeRow>();
  for (const o of offices) if (!byQid.has(o.qid)) byQid.set(o.qid, o);

  const terms = new Map<string, RawTerm>();
  const batches = chunk([...byQid.keys()], 25);

  for (const [i, batch] of batches.entries()) {
    const values = batch.map((q) => `wd:${q}`).join(' ');
    const rows = await sparql(
      `SELECT ?office ?officeLabel ?person ?personLabel ?start ?end ?election WHERE {
        VALUES ?office { ${values} }
        ?person p:P39 ?st .
        ?st ps:P39 ?office .
        # Wikidata records fictional presidents (TV shows) against real offices,
        # so restrict officeholders to actual humans.
        ?person wdt:P31 wd:Q5 .
        OPTIONAL { ?st pq:P580 ?start . }
        OPTIONAL { ?st pq:P582 ?end . }
        OPTIONAL { ?st pq:P2715 ?election . }
        FILTER(!BOUND(?end) || YEAR(?end) >= ${POLITICS_SINCE_YEAR})
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,de,fr,es". }
      }`,
      `politics-terms-v2-${i}`,
    );

    for (const row of rows) {
      const officeQid = qidFromUri(row.office.value);
      const personQid = qidFromUri(row.person.value);
      if (!officeQid || !personQid) continue;
      const source = byQid.get(officeQid);
      if (!source) continue;

      const start = row.start?.value;
      const end = row.end?.value;
      // A term with no dates at all can't be placed on a timeline, and an
      // open-ended term that started before 1945 is a pre-war holdover.
      if (!start && !end) continue;
      if (start && Number(start.slice(0, 4)) < POLITICS_SINCE_YEAR && !end) continue;

      const key = `${officeQid}|${personQid}|${start ?? ''}`;
      let term = terms.get(key);
      if (!term) {
        term = {
          iso2: source.iso2,
          role: source.role,
          officeQid,
          office: row.officeLabel?.value ?? officeQid,
          personQid,
          person: row.personLabel?.value ?? personQid,
          start,
          end,
          electionQids: [],
        };
        terms.set(key, term);
      }
      const electionQid = qidFromUri(row.election?.value);
      if (electionQid && !term.electionQids.includes(electionQid)) term.electionQids.push(electionQid);
    }
    console.log(`  terms batch ${i + 1}/${batches.length} — ${terms.size} terms so far`);
  }

  return [...terms.values()];
}

/** Dates for the elections referenced by `elected in` qualifiers on the terms. */
async function fetchElections(qids: Set<string>): Promise<RawElection[]> {
  const elections: RawElection[] = [];
  for (const [i, batch] of chunk([...qids], 150).entries()) {
    const values = batch.map((q) => `wd:${q}`).join(' ');
    const rows = await sparql(
      `SELECT ?election ?electionLabel ?date WHERE {
        VALUES ?election { ${values} }
        OPTIONAL { ?election wdt:P585 ?date . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,de,fr,es". }
      }`,
      `politics-elections-${i}`,
    );
    for (const row of rows) {
      const qid = qidFromUri(row.election.value);
      if (!qid || !row.date) continue;
      elections.push({ qid, label: row.electionLabel?.value ?? qid, date: row.date.value });
    }
    console.log(`  elections batch ${i + 1} — ${elections.length} dated`);
  }
  return elections;
}

/**
 * Party membership carries start/end qualifiers, so a leader who switched
 * parties mid-career is attributed to the party they held during the term
 * rather than to whichever membership Wikidata happens to list first.
 */
async function fetchParties(qids: Set<string>): Promise<PartyMembership[]> {
  const memberships: PartyMembership[] = [];
  for (const [i, batch] of chunk([...qids], 120).entries()) {
    const values = batch.map((q) => `wd:${q}`).join(' ');
    const rows = await sparql(
      `SELECT ?person ?partyLabel ?start ?end WHERE {
        VALUES ?person { ${values} }
        ?person p:P102 ?st .
        ?st ps:P102 ?party .
        OPTIONAL { ?st pq:P580 ?start . }
        OPTIONAL { ?st pq:P582 ?end . }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,de,fr,es". }
      }`,
      `politics-parties-${i}`,
    );
    for (const row of rows) {
      const personQid = qidFromUri(row.person.value);
      if (!personQid || !row.partyLabel) continue;
      memberships.push({
        personQid,
        party: row.partyLabel.value,
        start: row.start?.value,
        end: row.end?.value,
      });
    }
    console.log(`  parties batch ${i + 1} — ${memberships.length} memberships`);
  }
  return memberships;
}

export async function fetchPoliticalHistory() {
  console.log('Fetching head-of-state / head-of-government offices...');
  const offices = await fetchOffices();
  console.log(`  ${offices.length} offices across ${new Set(offices.map((o) => o.iso2)).size} countries`);

  console.log('Fetching officeholder terms...');
  const terms = await fetchTerms(offices);

  const electionQids = new Set(terms.flatMap((t) => t.electionQids));
  console.log(`Fetching ${electionQids.size} elections...`);
  const elections = await fetchElections(electionQids);

  const personQids = new Set(terms.map((t) => t.personQid));
  console.log(`Fetching party memberships for ${personQids.size} people...`);
  const parties = await fetchParties(personQids);

  return { terms, elections, parties };
}
