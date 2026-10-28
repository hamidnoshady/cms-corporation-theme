'use client';
import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { X } from 'lucide-react';
import type { Locale } from '@/lib/cms/types';
const subscribe = () => () => {};
export function Announcement({
  text,
  href,
  locale,
}: {
  text: string;
  href: string | null;
  locale: Locale;
}) {
  const [dismissed, dismiss] = useState(false);
  const saved = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return sessionStorage.getItem('apex-announcement') === text;
      } catch {
        return false;
      }
    },
    () => false,
  );
  if (dismissed || saved) return null;
  return (
    <div className="bg-background-soft-2 border-b border-border">
      <div className="page-shell flex items-center justify-center gap-4">
        <p className="t-body-sm py-3">
          {href ? (
            <Link href={href} className="underline underline-offset-4">
              {text}
            </Link>
          ) : (
            text
          )}
        </p>
        <button
          type="button"
          className="btn btn-ghost !px-3 shrink-0"
          aria-label={locale === 'fa' ? 'بستن اطلاعیه' : 'Dismiss announcement'}
          onClick={() => {
            try {
              sessionStorage.setItem('apex-announcement', text);
            } catch {}
            dismiss(true);
          }}
        >
          <X size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
