/**
 * Writes the hand-curated events/relationships datasets to public/data,
 * after validating that every country id they reference actually exists in
 * the generated country index (catches typos and stale codes at build time
 * instead of silently breaking the UI).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { EVENTS, EVENTS_START_YEAR } from './curated/events';
import { RELATIONSHIPS } from './curated/relationships';
import { writePublicData } from './lib/http';

async function main() {
  const indexPath = path.resolve(import.meta.dirname, '../public/data/countries/index.json');
  const index = JSON.parse(await readFile(indexPath, 'utf-8')) as { id: string }[];
  const validIds = new Set(index.map((c) => c.id));

  const unknownEventCountries = new Set<string>();
  const tooOld: string[] = [];
  for (const event of EVENTS) {
    for (const id of event.countries) {
      if (!validIds.has(id)) unknownEventCountries.add(`${event.id}: ${id}`);
    }
    if (Number(event.date.slice(0, 4)) < EVENTS_START_YEAR) tooOld.push(`${event.id} (${event.date})`);
  }
  if (tooOld.length) {
    throw new Error(`Events predate the ${EVENTS_START_YEAR} start of the atlas:\n${tooOld.join('\n')}`);
  }
  if (unknownEventCountries.size) {
    throw new Error(`Events reference unknown country ids:\n${[...unknownEventCountries].join('\n')}`);
  }

  const unknownRelCountries = new Set<string>();
  for (const rel of RELATIONSHIPS) {
    for (const id of rel.countries) {
      if (!validIds.has(id)) unknownRelCountries.add(`${rel.id}: ${id}`);
    }
  }
  if (unknownRelCountries.size) {
    throw new Error(`Relationships reference unknown country ids:\n${[...unknownRelCountries].join('\n')}`);
  }

  await writePublicData('events.json', [...EVENTS].sort((a, b) => a.date.localeCompare(b.date)));
  await writePublicData('relationships.json', RELATIONSHIPS);

  console.log(`\nDone: ${EVENTS.length} events, ${RELATIONSHIPS.length} relationships.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
