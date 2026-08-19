/**
 * Writes public/data/politics/<CC>.json — one file per country holding every
 * head-of-state / head-of-government term since 1945 plus the elections behind
 * them. Loaded lazily by the country card, so the payload stays off the
 * initial page load. Run via `npm run data:politics`.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fetchPoliticalHistory, POLITICS_SINCE_YEAR, type PartyMembership, type RawTerm } from './fetch-politics';
import type { LeadershipTerm, PoliticalElection, PoliticalHistory, Source } from '../src/types/domain';

const OUT_DIR = path.resolve(import.meta.dirname, '../public/data/politics');

function wikidataSource(qid: string): Source {
  return {
    org: 'Wikidata',
    dataset: `Wikidata item ${qid}`,
    url: `https://www.wikidata.org/wiki/${qid}`,
    date: new Date().toISOString().slice(0, 10),
  };
}

const isoDate = (value: string | undefined) => (value ? value.slice(0, 10) : undefined);

/**
 * Pick the party the person actually belonged to during the term. Falls back to
 * an undated membership (the common case for people with a single lifelong
 * party) and only then gives up.
 */
function partyForTerm(term: RawTerm, memberships: PartyMembership[]): string | undefined {
  if (!memberships.length) return undefined;
  const anchor = term.start ?? term.end;
  if (anchor) {
    const overlapping = memberships.filter((m) => {
      if (m.start && m.start > anchor) return false;
      if (m.end && m.end < anchor) return false;
      return Boolean(m.start || m.end);
    });
    // Long-defunct memberships are often left open-ended on Wikidata, so a
    // career politician overlaps several. The most recently joined one wins.
    if (overlapping.length) {
      return overlapping.sort((a, b) => (b.start ?? '').localeCompare(a.start ?? ''))[0].party;
    }
  }
  const undated = memberships.find((m) => !m.start && !m.end);
  return undated?.party ?? memberships[0].party;
}

async function main() {
  const indexPath = path.resolve(import.meta.dirname, '../public/data/countries/index.json');
  const index = JSON.parse(await readFile(indexPath, 'utf-8')) as { id: string }[];
  const validIds = new Set(index.map((c) => c.id));

  const { terms, elections, parties } = await fetchPoliticalHistory();

  const electionsByQid = new Map<string, PoliticalElection>();
  for (const e of elections) {
    electionsByQid.set(e.qid, { id: e.qid, label: e.label, date: e.date.slice(0, 10) });
  }

  const partiesByPerson = new Map<string, PartyMembership[]>();
  for (const m of parties) {
    const list = partiesByPerson.get(m.personQid) ?? [];
    list.push(m);
    partiesByPerson.set(m.personQid, list);
  }

  const byCountry = new Map<string, LeadershipTerm[]>();
  for (const term of terms) {
    if (!validIds.has(term.iso2)) continue;
    const termElections = term.electionQids
      .map((qid) => electionsByQid.get(qid))
      .filter((e): e is PoliticalElection => Boolean(e))
      .sort((a, b) => a.date.localeCompare(b.date));

    const entry: LeadershipTerm = {
      id: `${term.officeQid}-${term.personQid}-${isoDate(term.start) ?? 'unknown'}`,
      role: term.role,
      office: term.office,
      person: term.person,
      personQid: term.personQid,
      start: isoDate(term.start),
      end: isoDate(term.end),
      party: partyForTerm(term, partiesByPerson.get(term.personQid) ?? []),
      elections: termElections,
    };

    const list = byCountry.get(term.iso2) ?? [];
    list.push(entry);
    byCountry.set(term.iso2, list);
  }

  await mkdir(OUT_DIR, { recursive: true });
  let totalTerms = 0;
  let totalElections = 0;

  for (const [id, list] of byCountry) {
    // Newest first: the card reads as "who runs this country, and who came before".
    list.sort((a, b) => (b.start ?? b.end ?? '').localeCompare(a.start ?? a.end ?? ''));

    const countryElections = new Map<string, PoliticalElection>();
    for (const term of list) {
      for (const e of term.elections) {
        if (Number(e.date.slice(0, 4)) >= POLITICS_SINCE_YEAR) countryElections.set(e.id, e);
      }
    }

    const history: PoliticalHistory = {
      id,
      terms: list,
      elections: [...countryElections.values()].sort((a, b) => b.date.localeCompare(a.date)),
      sources: [wikidataSource(list[0].personQid)],
    };
    await writeFile(path.join(OUT_DIR, `${id}.json`), JSON.stringify(history), 'utf-8');
    totalTerms += list.length;
    totalElections += history.elections.length;
  }

  console.log(
    `\nDone: ${totalTerms} terms and ${totalElections} elections across ${byCountry.size} countries (since ${POLITICS_SINCE_YEAR}).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
