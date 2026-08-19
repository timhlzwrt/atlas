import { type Env, fetchGlobalHeadlines, getCachedNews, jsonResponse, GLOBAL_TTL } from './_shared';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const news = await getCachedNews(env, 'news:global', GLOBAL_TTL, () => fetchGlobalHeadlines(env));
  return jsonResponse(news);
};
