/**
 * Bulk-fetches the latest available value per country for a fixed set of World
 * Bank indicators. `mrnev=1` (most recent non-empty value) gets one row per
 * country in a single call, whatever year that happens to be — the year is
 * preserved so the UI can show "World Bank · 2024" style provenance.
 */
import { cachedFetchJson } from './lib/http';

export interface WorldBankIndicatorDef {
  metric: string;
  code: string;
  unit: string;
}

export const WORLD_BANK_INDICATORS: WorldBankIndicatorDef[] = [
  { metric: 'population', code: 'SP.POP.TOTL', unit: 'people' },
  { metric: 'populationDensity', code: 'EN.POP.DNST', unit: 'people/km²' },
  { metric: 'area', code: 'AG.LND.TOTL.K2', unit: 'km²' },
  { metric: 'gdp', code: 'NY.GDP.MKTP.CD', unit: 'USD' },
  { metric: 'gdpPerCapita', code: 'NY.GDP.PCAP.CD', unit: 'USD' },
  { metric: 'gdpGrowth', code: 'NY.GDP.MKTP.KD.ZG', unit: '%' },
  { metric: 'gdpPpp', code: 'NY.GDP.MKTP.PP.CD', unit: 'intl $' },
  { metric: 'inflation', code: 'FP.CPI.TOTL.ZG', unit: '%' },
  { metric: 'unemployment', code: 'SL.UEM.TOTL.ZS', unit: '% of labor force' },
  { metric: 'militaryExpenditure', code: 'MS.MIL.XPND.CD', unit: 'USD' },
  { metric: 'militaryExpenditurePctGdp', code: 'MS.MIL.XPND.GD.ZS', unit: '% of GDP' },
  { metric: 'lifeExpectancy', code: 'SP.DYN.LE00.IN', unit: 'years' },
  { metric: 'literacyRate', code: 'SE.ADT.LITR.ZS', unit: '% of adults' },
];

interface WorldBankRow {
  country: { id: string; value: string };
  countryiso3code: string;
  date: string;
  value: number | null;
}

export interface IndicatorValue {
  value: number;
  year: string;
}

/** metric -> iso3 -> { value, year } */
export async function fetchWorldBankIndicators(): Promise<Record<string, Record<string, IndicatorValue>>> {
  const result: Record<string, Record<string, IndicatorValue>> = {};

  for (const { metric, code } of WORLD_BANK_INDICATORS) {
    const url = `https://api.worldbank.org/v2/country/all/indicator/${code}?format=json&per_page=400&mrnev=1`;
    const [, rows] = await cachedFetchJson<[unknown, WorldBankRow[]]>(url, `wb-${code}`);
    const byIso3: Record<string, IndicatorValue> = {};
    for (const row of rows ?? []) {
      if (row.value === null || !row.countryiso3code) continue;
      byIso3[row.countryiso3code] = { value: row.value, year: row.date };
    }
    result[metric] = byIso3;
    console.log(`world bank ${code}: ${Object.keys(byIso3).length} countries`);
  }

  return result;
}
