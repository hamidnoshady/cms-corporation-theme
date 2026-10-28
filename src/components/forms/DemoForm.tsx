'use client';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Loader2 } from 'lucide-react';
import type { FormField, Locale } from '@/lib/cms/types';
import { getDict } from '@/lib/i18n/dict';
import { fieldMaxLength, validateFields } from '@/lib/integrations/form-schema';
import { readAttribution } from '../analytics/Analytics';
export function DemoForm({
  locale,
  fields,
  ready,
  privacyHref,
  formId,
  submitLabel,
}: {
  locale: Locale;
  fields: FormField[];
  ready: boolean;
  privacyHref: string;
  formId?: string;
  submitLabel?: string;
}) {
  const t = getDict(locale);
  const uid = useId();
  const resultRef = useRef<HTMLDivElement>(null);
  const [challenge, setChallenge] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'success'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch('/api/leads/challenge', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('not_ready');
        const data = (await res.json()) as { token: string };
        await new Promise((resolve) => setTimeout(resolve, 1600));
        if (!controller.signal.aborted) setChallenge(data.token);
      } catch {
        if (!controller.signal.aborted) setNotice(t.sendFailed);
      }
    })();
    return () => controller.abort();
  }, [ready, t.sendFailed]);
  useEffect(() => {
    if (state === 'success') resultRef.current?.focus();
  }, [state]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !challenge || state === 'sending') return;
    const form = event.currentTarget;
    const fd = new FormData(form);
    const data = Object.fromEntries(
      fields
        .filter((f) => f.name)
        .map((f) => [
          f.name!,
          f.blockType === 'checkbox' ? fd.get(f.name!) === 'on' : String(fd.get(f.name!) ?? ''),
        ]),
    );
    const validation = validateFields(data, fields);
    const nextErrors: Record<string, string> = Object.fromEntries(
      Object.entries(validation.errors).map(([k, v]) => [
        k,
        v === 'required' ? t.required : t.invalid,
      ]),
    );
    if (fd.get('consent') !== 'on') nextErrors.consent = t.required;
    setErrors(nextErrors);
    setNotice('');
    if (Object.keys(nextErrors).length) {
      const first = form.elements.namedItem(Object.keys(nextErrors)[0]);
      if (first instanceof HTMLElement) first.focus();
      return;
    }
    setState('sending');
    try {
      let analyticsConsent = false;
      try {
        analyticsConsent = localStorage.getItem('apex-analytics') === 'yes';
      } catch {}
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          consent: true,
          locale,
          formId,
          challenge,
          website: fd.get('website'),
          attribution: readAttribution(),
          analyticsConsent,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        errors?: Record<string, string>;
        challenge?: string;
      };
      if (res.ok && body.ok) {
        setState('success');
        return;
      }
      if (body.challenge) setChallenge(body.challenge);
      if (body.errors)
        setErrors(
          Object.fromEntries(
            Object.entries(body.errors).map(([k, v]) => [
              k,
              v === 'required' ? t.required : t.invalid,
            ]),
          ),
        );
      setNotice(
        res.status === 429
          ? t.rateLimit
          : body.error === 'not_configured'
            ? t.notConnected
            : t.sendFailed,
      );
    } catch {
      setNotice(t.sendFailed);
    }
    setState('idle');
  }
  if (state === 'success')
    return (
      <div ref={resultRef} tabIndex={-1} role="status" className="card p-8">
        <CheckCircle2 size={28} strokeWidth={1.5} aria-hidden="true" />
        <h2 className="t-h2 mt-5">{t.sent}</h2>
        <p className="t-body mt-3">{t.sentBody}</p>
      </div>
    );
  return (
    <form onSubmit={submit} className="card lead-form" noValidate>
      {!ready && (
        <p className="form-notice" role="status">
          {t.notConnected}
        </p>
      )}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor={`${uid}-website`}>{t.honeypot}</label>
        <input id={`${uid}-website`} name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="error-msg">
          {t.review}
        </p>
      )}
      {notice && (
        <p role="alert" className="form-notice">
          {notice}
        </p>
      )}
      {ready && notice && !challenge && (
        <button
          type="button"
          className="btn btn-secondary self-start"
          onClick={async () => {
            setNotice('');
            try {
              const response = await fetch('/api/leads/challenge', {
                cache: 'no-store',
                signal: AbortSignal.timeout(5000),
              });
              if (!response.ok) throw new Error('not_ready');
              const data = (await response.json()) as { token: string };
              await new Promise((resolve) => setTimeout(resolve, 1600));
              setChallenge(data.token);
            } catch {
              setNotice(t.sendFailed);
            }
          }}
        >
          {t.retry}
        </button>
      )}
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) => {
          if (!field.name) return null;
          const id = `${uid}-${field.name}`;
          const error = errors[field.name];
          const type = field.blockType;
          const props = {
            id,
            name: field.name,
            required: field.required,
            'aria-invalid': !!error,
            'aria-describedby': error ? `${id}-error` : undefined,
            maxLength: fieldMaxLength(field),
          };
          return (
            <div
              key={field.name}
              className={`field ${type === 'textarea' || field.width === 100 ? 'sm:col-span-2' : ''}`}
            >
              {type === 'checkbox' ? (
                <label className="checkbox-label" htmlFor={id}>
                  <input {...props} type="checkbox" />
                  {field.label ?? field.name}
                </label>
              ) : (
                <>
                  <label htmlFor={id}>
                    {field.label ?? field.name}
                    {field.required && <span aria-hidden="true"> *</span>}
                  </label>
                  {type === 'textarea' ? (
                    <textarea {...props} rows={4} />
                  ) : type === 'select' ? (
                    <select {...props} defaultValue="">
                      <option value="" disabled>
                        {t.choose}
                      </option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      {...props}
                      type={type === 'email' ? 'email' : field.name === 'phone' ? 'tel' : 'text'}
                      inputMode={type === 'number' ? 'decimal' : undefined}
                      autoComplete={
                        field.name === 'name'
                          ? 'name'
                          : field.name === 'phone'
                            ? 'tel'
                            : field.name === 'email'
                              ? 'email'
                              : field.name === 'city'
                                ? 'address-level2'
                                : undefined
                      }
                      dir={field.name === 'phone' || type === 'email' ? 'ltr' : undefined}
                    />
                  )}
                </>
              )}
              {error && (
                <span className="error-msg" id={`${id}-error`}>
                  {error}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div>
        <label htmlFor={`${uid}-consent`} className="checkbox-label">
          <input
            id={`${uid}-consent`}
            name="consent"
            type="checkbox"
            required
            aria-invalid={!!errors.consent}
            aria-describedby={errors.consent ? `${uid}-consent-error` : undefined}
          />
          <span>
            {t.consent}{' '}
            <Link href={privacyHref} className="underline underline-offset-4">
              {t.privacy}
            </Link>
          </span>
        </label>
        {errors.consent && (
          <p id={`${uid}-consent-error`} className="error-msg">
            {errors.consent}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={!ready || !challenge || state === 'sending'}
        className="btn btn-primary btn-lg w-full sm:w-auto sm:self-start"
      >
        {state === 'sending' ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            {t.sending}
          </>
        ) : ready && !challenge ? (
          t.preparing
        ) : (
          <>
            {submitLabel ?? t.submit}
            <ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}
