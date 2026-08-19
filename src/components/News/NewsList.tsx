import { useEffect, useState } from 'react';
import { fetchCountryNews, fetchGlobalNews } from '../../lib/api';
import type { NewsResponse } from '../../types/domain';
import './news.css';

interface NewsListProps {
  countryId?: string;
}

export function NewsList({ countryId }: NewsListProps) {
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [news, setNews] = useState<NewsResponse | null>(null);

  useEffect(() => {
    setState('loading');
    const load = countryId ? fetchCountryNews(countryId) : fetchGlobalNews();
    load
      .then((res) => {
        setNews(res);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [countryId]);

  if (state === 'loading') {
    return (
      <div className="news-list" aria-busy="true">
        <div className="skeleton-line" style={{ width: '90%' }} />
        <div className="skeleton-line" style={{ width: '70%' }} />
      </div>
    );
  }

  if (state === 'error' || !news) {
    return <p className="section-hint">News is temporarily unavailable.</p>;
  }

  if (news.articles.length === 0) {
    return <p className="section-hint">No recent news found{countryId ? ' for this country' : ''}.</p>;
  }

  return (
    <div className="news-list">
      {news.stale && <p className="news-list__stale">Showing cached results — live updates temporarily paused.</p>}
      <ul>
        {news.articles.map((a) => (
          <li key={a.url}>
            <a href={a.url} target="_blank" rel="noreferrer noopener" className="news-item">
              <span className="news-item__title">{a.title}</span>
              <span className="news-item__meta">
                {a.publisher} · {new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
