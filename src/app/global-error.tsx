'use client';
export default function GlobalError({ reset }: { reset: () => void }) {
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
      </body>
    </html>
  );
}
