'use client';

/**
 * Last-resort fallback when the root layout itself cannot render (for example a
 * CMS outage). It stays dependency-free and bilingual, and shows Next's error
 * digest as a support reference so an operator can match the browser to the
 * server log line. It never renders an error message, upstream detail or secret.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error?: Error & { digest?: string };
  reset: () => void;
}) {
  const reference =
    typeof error?.digest === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(error.digest)
      ? error.digest
      : null;
  return (
    <html lang="fa" dir="rtl">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          padding: '4rem 1.5rem',
          maxWidth: '48rem',
          margin: 'auto',
        }}
      >
        <h1>سرویس موقتاً در دسترس نیست.</h1>
        <p lang="en" dir="ltr">
          The site is temporarily unavailable. Please try again.
        </p>
        <button type="button" onClick={reset} style={{ padding: '1rem', marginBlockStart: '1rem' }}>
          تلاش دوباره / Retry
        </button>
        {reference && (
          <p lang="en" dir="ltr" style={{ fontSize: '0.875rem', opacity: 0.7 }}>
            Reference: <code>{reference}</code>
          </p>
        )}
      </body>
    </html>
  );
}
