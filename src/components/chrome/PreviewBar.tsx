'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/cms/types';
import { getDict } from '@/lib/i18n/dict';
export function PreviewBar({ locale }: { locale: Locale }) {
  const router = useRouter();
  const t = getDict(locale);
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [router]);
  // A full navigation is required: this route clears an HttpOnly preview grant.
  return (
    <aside className="preview-bar">
      <span>{t.preview}</span>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- This handler clears an HttpOnly cookie. */}
      <a href="/next/exit-preview" className="underline py-3">
        {t.exitPreview}
      </a>
    </aside>
  );
}
