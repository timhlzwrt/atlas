import type { Relationship } from '../../src/types/domain';

const today = new Date().toISOString().slice(0, 10);

/**
 * A deliberately small, real, sourced set of geopolitical relationships for
 * the MVP relationship-layer feature (opt-in, off by default). Membership
 * lists reflect the current state as of this build and are stable, widely
 * documented facts (see each relationship's source).
 */
export const RELATIONSHIPS: Relationship[] = [
  {
    id: 'nato',
    type: 'military',
    label: 'NATO',
    description: 'North Atlantic Treaty Organization — a collective-defense military alliance of North American and European states.',
    countries: [
      'AL', 'BE', 'BG', 'CA', 'HR', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS', 'IT',
      'LV', 'LT', 'LU', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'TR', 'GB', 'US',
    ],
    sources: [{ org: 'NATO', dataset: 'Member countries', url: 'https://www.nato.int/cps/en/natohq/nato_countries.htm', date: today }],
  },
  {
    id: 'eu',
    type: 'alliance',
    label: 'European Union',
    description: 'A political and economic union of European states with a shared single market and, for most members, a common currency.',
    countries: [
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT',
      'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
    ],
    sources: [{ org: 'European Union', dataset: 'Countries', url: 'https://european-union.europa.eu/principles-countries-history/country-profiles_en', date: today }],
  },
  {
    id: 'usmca',
    type: 'trade',
    label: 'USMCA',
    description: 'A free-trade agreement between the United States, Mexico, and Canada, succeeding NAFTA in 2020.',
    countries: ['US', 'MX', 'CA'],
    sources: [{ org: 'Office of the United States Trade Representative', dataset: 'USMCA', url: 'https://ustr.gov/trade-agreements/free-trade-agreements/agreement-between-united-states-mexico-and-canada-usmca', date: today }],
  },
  {
    id: 'mercosur',
    type: 'trade',
    label: 'Mercosur',
    description: 'A South American trade bloc promoting free movement of goods, capital, services, and people among member states.',
    countries: ['BR', 'AR', 'UY', 'PY'],
    sources: [{ org: 'Mercosur', dataset: 'About Mercosur', url: 'https://www.mercosur.int/en/', date: today }],
  },
  {
    id: 'five-eyes',
    type: 'diplomatic',
    label: 'Five Eyes',
    description: 'An intelligence-sharing alliance among Australia, Canada, New Zealand, the United Kingdom, and the United States, rooted in a 1946 signals-intelligence agreement.',
    countries: ['US', 'GB', 'CA', 'AU', 'NZ'],
    sources: [{ org: 'Wikipedia', dataset: 'Five Eyes', url: 'https://en.wikipedia.org/wiki/Five_Eyes', date: today }],
  },
  {
    id: 'russia-ukraine-war',
    type: 'conflict',
    label: 'Russian invasion of Ukraine',
    description: 'Full-scale war since February 2022, the largest interstate conflict in Europe since World War II.',
    countries: ['RU', 'UA'],
    sources: [{ org: 'Wikipedia', dataset: 'Russian invasion of Ukraine', url: 'https://en.wikipedia.org/wiki/Russian_invasion_of_Ukraine', date: today }],
  },
  {
    id: 'israel-palestine-conflict',
    type: 'conflict',
    label: 'Israeli–Palestinian conflict',
    description: 'A long-running territorial and political conflict between Israel and Palestinians, encompassing the Israeli-occupied territories and the status of Gaza and the West Bank.',
    countries: ['IL', 'PS'],
    sources: [{ org: 'Wikipedia', dataset: 'Israeli–Palestinian conflict', url: 'https://en.wikipedia.org/wiki/Israeli%E2%80%93Palestinian_conflict', date: today }],
  },
  {
    id: 'korea-armistice',
    type: 'conflict',
    label: 'Korean War armistice (unresolved)',
    description: 'North and South Korea remain technically at war under a 1953 armistice; no peace treaty has ever been signed.',
    countries: ['KP', 'KR'],
    sources: [{ org: 'Wikipedia', dataset: 'Korean Armistice Agreement', url: 'https://en.wikipedia.org/wiki/Korean_Armistice_Agreement', date: today }],
  },
];
