import type { CountryProfile } from '../../src/types/domain';
import { flagEmoji } from '../lib/flag-emoji';

/**
 * Entities present in the base geometry that fall outside the automated
 * Wikidata sovereign-state query (no ISO 3166-1 alpha-2 code assigned, so the
 * P297-based pipeline can't pick them up). Handled as a short, explicit list
 * rather than a general mechanism — see docs/DATA_SOURCES.md.
 *
 * No population/economic statistics are included here because no indexed
 * statistical source (World Bank, UN) tracks Somaliland separately from
 * Somalia; showing a number without that kind of provenance would violate
 * this project's no-fake-data rule.
 */
export const SPECIAL_TERRITORIES: CountryProfile[] = [
  {
    id: 'EH',
    iso3: 'ESH',
    name: 'Western Sahara',
    officialName: 'Sahrawi Arab Democratic Republic (proclaimed) / Western Sahara',
    region: 'Africa',
    capital: 'Laâyoune (Moroccan-administered) / Tifariti (SADR-administered)',
    flagEmoji: flagEmoji('EH'),
    recognitionStatus: 'disputed',
    hasDeepData: false,
    languages: [],
    neighbors: ['MA', 'DZ', 'MR'],
    borders: ['MA', 'DZ', 'MR'],
    statistics: {},
    sources: [
      {
        org: 'Wikidata',
        dataset: 'Western Sahara (Q6250)',
        url: 'https://www.wikidata.org/wiki/Q6250',
        date: new Date().toISOString().slice(0, 10),
      },
      {
        org: 'United Nations',
        dataset: 'Non-Self-Governing Territories',
        url: 'https://www.un.org/dppa/decolonization/en/nsgt',
        date: new Date().toISOString().slice(0, 10),
      },
    ],
  },
  {
    id: 'XS',
    iso3: 'XXS',
    name: 'Somaliland',
    officialName: 'Republic of Somaliland',
    region: 'Africa',
    capital: 'Hargeisa',
    flagEmoji: flagEmoji('XS'),
    recognitionStatus: 'de-facto',
    hasDeepData: false,
    languages: [],
    neighbors: ['SO', 'ET', 'DJ'],
    borders: ['SO', 'ET', 'DJ'],
    statistics: {},
    sources: [
      {
        org: 'Wikidata',
        dataset: 'Somaliland (Q34754)',
        url: 'https://www.wikidata.org/wiki/Q34754',
        date: new Date().toISOString().slice(0, 10),
      },
    ],
  },
];
