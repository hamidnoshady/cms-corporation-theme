import { toAsciiDigits } from '@eshobe/site-runtime';
import type { FormDoc, FormField, Locale } from '../cms/types';
import { getDict } from '../i18n/dict';
const supported = new Set(['text', 'email', 'number', 'textarea', 'select', 'checkbox']);
export function leadFields(form: FormDoc | null | undefined, locale: Locale): FormField[] {
  const t = getDict(locale);
  const defaults: FormField[] = [
    { name: 'name', label: t.name, blockType: 'text', required: true },
    { name: 'phone', label: t.phone, blockType: 'text', required: true },
    { name: 'email', label: t.email, blockType: 'email' },
    {
      name: 'businessType',
      label: t.businessType,
      blockType: 'select',
      required: true,
      options: [
        { value: 'restaurant', label: t.restaurant },
        { value: 'cafe', label: t.cafe },
        { value: 'other', label: t.other },
      ],
    },
    { name: 'city', label: t.city, blockType: 'text', required: true },
    { name: 'message', label: t.message, blockType: 'textarea' },
  ];
  if (!form?.fields?.length) return defaults;
  const seen = new Set<string>();
  const fields = form.fields
    .slice(0, 30)
    .filter(
      (f) =>
        f.name &&
        /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(f.name) &&
        ![
          'constructor',
          'prototype',
          'consent',
          'website',
          'site',
          'siteId',
          'tenant',
          'token',
        ].includes(f.name) &&
        supported.has(f.blockType ?? '') &&
        !seen.has(f.name) &&
        !!seen.add(f.name),
    )
    .map((field): FormField => {
      // Reserved CRM fields retain their contract semantics when edited in the CMS.
      if (field.name === 'name') return { ...field, blockType: 'text', required: true };
      if (field.name === 'phone') return { ...field, blockType: 'text' };
      if (field.name === 'email') return { ...field, blockType: 'email' };
      if (field.name === 'message') return { ...field, blockType: 'textarea' };
      return field;
    });
  // Every lead needs a name and a means of contact, even if an editor omits them.
  if (!fields.some((f) => f.name === 'name')) fields.unshift(defaults[0]);
  if (!fields.some((f) => f.name === 'phone' || f.name === 'email')) fields.push(defaults[1]);
  return fields;
}
export function normalizePhone(value: string): string {
  const phone = toAsciiDigits(value).replace(/[\s()-]/g, '');
  if (/^0\d{10}$/.test(phone)) return '+98' + phone.slice(1);
  if (/^0098\d{10}$/.test(phone)) return '+' + phone.slice(2);
  if (/^98\d{10}$/.test(phone)) return '+' + phone;
  return phone;
}
export function fieldMaxLength(field: FormField): number {
  if (field.name === 'name') return 160;
  if (field.name === 'phone') return 40;
  if (field.name === 'email') return 254;
  return field.blockType === 'textarea' ? 3000 : 254;
}
export function validateFields(raw: unknown, fields: FormField[]) {
  const data =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const errors: Record<string, 'required' | 'invalid'> = {};
  const values: Record<string, string | boolean> = {};
  for (const field of fields) {
    if (!field.name) continue;
    const value = data[field.name];
    const name = field.name;
    if (field.blockType === 'checkbox') {
      values[name] = value === true;
      if (field.required && value !== true) errors[name] = 'required';
      continue;
    }
    if (typeof value !== 'string') {
      values[name] = '';
      if (field.required) errors[name] = 'required';
      continue;
    }
    const text = value.trim();
    const max = fieldMaxLength(field);
    values[name] = text;
    if (field.required && !text) errors[name] = 'required';
    if (text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text))
      errors[name] = 'invalid';
    if (text && field.blockType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
      errors[name] = 'invalid';
    if (text && field.blockType === 'number' && !/^-?\d+(\.\d+)?$/.test(toAsciiDigits(text)))
      errors[name] = 'invalid';
    if (text && field.blockType === 'select' && !field.options?.some((o) => o.value === text))
      errors[name] = 'invalid';
    if (name === 'phone' && text) {
      values[name] = normalizePhone(text);
      if (!/^\+?[1-9]\d{7,14}$/.test(String(values[name]))) errors[name] = 'invalid';
    }
  }
  if (!String(values.name ?? '').trim()) errors.name = 'required';
  if (!values.phone && !values.email)
    errors[fields.some((f) => f.name === 'phone') ? 'phone' : 'email'] = 'required';
  return { values, errors };
}
export function attribution(raw: unknown) {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    if (typeof input[k] === 'string')
      out[k] = input[k].replace(/[\u0000-\u001f]/g, '').slice(0, 120);
  }
  if (
    typeof input.path === 'string' &&
    !input.path.startsWith('//') &&
    /^\/[\p{L}\p{N}/_%.-]*$/u.test(input.path)
  )
    out.path = input.path.slice(0, 200);
  if (typeof input.referrer === 'string') {
    try {
      out.referrer = new URL(input.referrer).origin;
    } catch {}
  }
  return out;
}
