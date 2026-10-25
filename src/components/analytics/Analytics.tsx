'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/lib/cms/types';
import { getDict } from '@/lib/i18n/dict';
export type BrowserEvent = 'pageview' | 'demo_cta' | 'onboarding_click';
export function track(event: BrowserEvent) {
  try {
    if (localStorage.getItem('apex-analytics') !== 'yes') return;
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, path: location.pathname, consent: true }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* Storage disabled or metrics unavailable must not block a form. */
  }
}
export function readAttribution(): Record<string, string> {
  const current: Record<string, string> = { path: location.pathname, referrer: document.referrer };
  const query = new URLSearchParams(location.search);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const value = query.get(key);
    if (value) current[key] = value.slice(0, 120);
  }
  try {
    const previous = sessionStorage.getItem('apex-attribution');
    if (previous) return JSON.parse(previous) as Record<string, string>;
    sessionStorage.setItem('apex-attribution', JSON.stringify(current));
  } catch {}
  return current;
}
export function Analytics({ enabled, locale }: { enabled: boolean; locale: Locale }) {
  const t = getDict(locale);
  const path = usePathname();
  const [choice, choose] = useState<'yes' | 'no' | null>(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    // Attribution stays session-local until the visitor explicitly submits a lead.
    readAttribution();
    if (!enabled) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('apex-analytics');
    } catch {}
    const timer = setTimeout(() => {
      if (saved === 'yes' || saved === 'no') choose(saved);
      else setShow(true);
    }, 0);
    if (saved === 'yes') track('pageview');
    const click = (event: MouseEvent) => {
      const element =
        event.target instanceof Element ? event.target.closest('[data-analytics-event]') : null;
      const name = element?.getAttribute('data-analytics-event');
      if (name === 'demo_cta' || name === 'onboarding_click') track(name);
    };
    document.addEventListener('click', click);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', click);
    };
  }, [enabled, path]);
  if (!enabled) return null;
  const save = (value: 'yes' | 'no') => {
    choose(value);
    setShow(false);
    try {
      localStorage.setItem('apex-analytics', value);
    } catch {}
    if (value === 'yes') track('pageview');
  };
  return (
    <div className="analytics-preferences page-shell py-3">
      {show ? (
        <section
          className="card flex flex-wrap items-center gap-4"
          aria-label={t.analyticsSettings}
        >
          <p className="t-body-sm flex-1 min-w-48">{t.analytics}</p>
          <button type="button" className="btn btn-secondary" onClick={() => save('no')}>
            {t.decline}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => save('yes')}>
            {t.accept}
          </button>
        </section>
      ) : (
        <button
          type="button"
          className="btn btn-ghost t-body-sm"
          aria-pressed={choice === 'yes'}
          onClick={() => setShow(true)}
        >
          {t.analyticsSettings}
        </button>
      )}
    </div>
  );
}
