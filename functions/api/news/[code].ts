import { type Env, fetchCountryHeadlines, getCachedNews, jsonResponse, COUNTRY_TTL } from './_shared';
import { COUNTRY_NAMES } from './_country-names.generated';

export const onRequestGet: PagesFunction<Env> = async ({ params, env }) => {
  return handle(params.code as string, env);
};

async function handle(rawCode: string, env: Env) {
  const code = (rawCode ?? '').toUpperCase();
  // Reject anything that isn't a plausible ISO-style code before it ever
  // reaches an external API call or cache key.
  if (!/^[A-Z]{2,3}$/.test(code)) {
    return jsonResponse({ error: 'Invalid country code' }, { status: 400 });
  }
  const name = COUNTRY_NAMES[code];
  if (!name) {
    return jsonResponse({ error: 'Unknown country code' }, { status: 404 });
  }

  const news = await getCachedNews(env, `news:country:${code}`, COUNTRY_TTL, () => fetchCountryHeadlines(env, name));
  return jsonResponse(news);
}
