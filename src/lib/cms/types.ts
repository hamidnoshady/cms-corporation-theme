import type { Theme, CurrencyCode } from '@eshobe/site-runtime';

export type Locale = 'fa' | 'en';
export type Media = {
  id?: string;
  url?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string;
  caption?: RichText;
  sizes?: Record<string, Media>;
};
export type RichNode = {
  type?: string;
  text?: string;
  format?: number;
  tag?: string;
  listType?: string;
  direction?: 'ltr' | 'rtl';
  children?: RichNode[];
  fields?: Record<string, unknown>;
  value?: Media;
  relationTo?: string;
  url?: string;
};
export type RichText = { root?: RichNode } | null;
export type LinkData = {
  type?: 'custom' | 'reference';
  url?: string;
  label?: string;
  newTab?: boolean;
  appearance?: 'default' | 'outline';
  reference?: {
    relationTo?: string;
    value?: string | { id?: string; slug?: string; _status?: string };
  };
};
export type BindingRef = {
  id?: string | null;
  type?: string | null;
  slug?: string | null;
  title?: string | null;
};
export type ThemeRuntime = {
  theme?: { key?: string };
  settings?: Record<string, unknown> | null;
  bindings?: Record<string, BindingRef | null> | null;
};
export interface SiteDescriptor {
  id?: string;
  contractVersion: number;
  domain: string;
  name: string;
  slug: string;
  status?: string;
  type: 'business' | 'portfolio' | 'store';
  defaultLocale?: Locale;
  availableLocales?: Locale[];
  blocks?: string[];
  theme?: Theme;
  store?: { currency?: CurrencyCode };
  branding?: {
    displayName?: string;
    shortName?: string;
    tagline?: string;
    primaryLogo?: Media | null;
    lightLogo?: Media | null;
    darkLogo?: Media | null;
    favicon?: Media | null;
    socialImage?: Media | null;
  };
  media?: { origin: string; basePath: string };
  themeRuntime?: ThemeRuntime | null;
}
export type FormField = {
  id?: string;
  blockType?: string;
  name?: string;
  label?: string;
  required?: boolean;
  width?: number;
  options?: { label: string; value: string }[];
  message?: RichText;
  defaultValue?: string | boolean;
};
export interface FormDoc {
  id: string;
  title?: string;
  fields?: FormField[];
  submitButtonLabel?: string;
  confirmationMessage?: RichText;
  site?: string | { id: string };
}
export type Block = {
  id?: string;
  blockType: string;
  blockName?: string;
  heading?: string;
  intro?: string;
  columns?:
    | string
    | { size?: string; richText?: RichText; enableLink?: boolean; link?: LinkData }[];
  richText?: RichText;
  links?: { link: LinkData }[];
  media?: Media | string;
  caption?: RichText;
  items?: {
    title?: string;
    description?: string;
    icon?: Media | string;
    question?: string;
    answer?: string;
    quote?: string;
    author?: string;
    role?: string;
    avatar?: Media | string;
  }[];
  plans?: {
    name?: string;
    featured?: boolean;
    price?: number | null;
    unit?: string;
    period?: string;
    features?: (string | { feature?: string })[];
    enableLink?: boolean;
    link?: LinkData;
  }[];
  images?: (Media | string)[];
  logos?: (Media | string)[];
  members?: { name?: string; role?: string; bio?: string; photo?: Media | string }[];
  form?: FormDoc | string;
  enableIntro?: boolean;
  introContent?: RichText;
  address?: string;
  phones?: (string | { phone?: string })[];
  email?: string;
  hours?: string;
  populateBy?: string;
  selectedDocs?: { relationTo?: string; value?: PageDoc | string }[];
  limit?: number;
};
export interface PageDoc {
  id: string;
  slug: string;
  title?: string;
  _status?: 'published' | 'draft';
  site?: string | { id: string };
  hero?: {
    type?: string;
    richText?: RichText;
    links?: { link: LinkData }[];
    media?: Media | string;
  };
  layout?: Block[];
  content?: RichText;
  meta?: { title?: string; description?: string; image?: Media | string };
  publishedAt?: string;
  updatedAt?: string;
}
export const PAGE_SLOTS = [
  'home',
  'restaurants',
  'pricing',
  'features',
  'demo',
  'privacy',
] as const;
export type SlotKey = (typeof PAGE_SLOTS)[number];
export interface Snapshot {
  site: SiteDescriptor;
  pages: Partial<Record<SlotKey, PageDoc | null>>;
  form: FormDoc | null;
  header: { link: LinkData }[];
  footer: { link: LinkData }[];
  productMedia: Media | null;
  locale: Locale;
  preview: boolean;
  demo: boolean;
}
