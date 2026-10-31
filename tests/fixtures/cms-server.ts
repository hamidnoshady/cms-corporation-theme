/** Local test double, never shipped or used as a production lead/pricing service. */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { demoSnapshot, rich } from '../../src/lib/demo/content';
import type { Locale, PageDoc } from '../../src/lib/cms/types';
let state = {
  cmsDown: false,
  title: 'CMS published homepage',
  draft: false,
  missingEnglish: false,
  foreign: false,
  leadFailures: 0,
  malformedLead: false,
  renamed: false,
  // Redirect and slow-upstream modes for the deployment regression suite.
  redirectSite: false,
  delayMs: 0,
};
const requests: { path: string; authorization?: string; cookie?: string; method?: string }[] = [];
const leads = new Map<string, unknown>();
const events: unknown[] = [];
// One instance per contract surface: the deployment suite runs its own port so a
// Next data cache written by another local server cannot mask a real CMS read.
const PORT = Number(process.env.FIXTURE_PORT ?? 3300);
const server = createServer(async (req, res) => {
  const url = new URL(req.url!, `http://127.0.0.1:${PORT}`);
  const json = (body: unknown, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const data = async () => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    return raw ? JSON.parse(raw) : {};
  };
  if (url.pathname === '/__health') return json({ ok: true });
  if (url.pathname === '/__control') {
    if (req.method === 'POST') state = { ...state, ...(await data()) };
    return json({ state, requests, leads: [...leads.entries()], events });
  }
  requests.push({
    path: req.url!,
    authorization: req.headers.authorization,
    cookie: req.headers.cookie,
    method: req.method,
  });
  if (state.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, state.delayMs));
  if (state.redirectSite && url.pathname === '/api/site') {
    // A redirect target must never receive the site key: the client refuses to follow.
    res.writeHead(302, { Location: 'https://evil.example.test/api/site' });
    return res.end();
  }
  if (url.pathname === '/api/website/leads') {
    if (req.headers.authorization !== 'Bearer fixture-lead-token')
      return json({ error: 'unauthorized' }, 401);
    if (state.leadFailures > 0) {
      state.leadFailures--;
      return json({ error: 'temporary_failure' }, 503);
    }
    const body = await data();
    const key = String(req.headers['idempotency-key']);
    if (state.malformedLead) return json({ accepted: true });
    const duplicate = leads.has(key);
    if (!duplicate) leads.set(key, body);
    return json({ accepted: true, id: `fixture-${key}`, duplicate }, duplicate ? 200 : 201);
  }
  if (url.pathname === '/events') {
    events.push(await data());
    return json({ ok: true });
  }
  if (url.pathname === '/api/users/me') {
    const allowed = req.headers.cookie === 'payload-token=fixture-editor-token-site-a';
    return json({
      user: {
        role: 'user',
        tenants: [{ tenant: allowed ? 'fixture-site-a' : 'fixture-site-b', role: 'editor' }],
      },
    });
  }
  if (req.headers.authorization !== 'Bearer fixture-site-key')
    return json({ error: 'unauthorized' }, 401);
  if (state.cmsDown) return json({ error: 'temporarily_unavailable' }, 503);
  const locale: Locale = url.searchParams.get('locale') === 'en' ? 'en' : 'fa';
  const snap = demoSnapshot(locale);
  const site = {
    ...snap.site,
    id: 'fixture-site-a',
    name: 'Fixture company',
    domain: 'fixture.example.test',
    branding: { displayName: 'Fixture company', tagline: 'CMS-managed tenant identity' },
    themeRuntime: {
      ...snap.site.themeRuntime,
      settings: {
        ...snap.site.themeRuntime?.settings,
        announcementEnabled: true,
        announcementTextFa: 'اطلاعیهٔ آزمایشی',
        announcementTextEn: 'Test announcement',
      },
    },
  };
  if (url.pathname === '/api/site') return json(site);
  if (url.pathname.startsWith('/api/globals/'))
    return json({ navItems: url.pathname.endsWith('header') ? snap.header : snap.footer });
  if (url.pathname.startsWith('/api/media/file/')) {
    res.writeHead(200, { 'Content-Type': 'image/webp' });
    return res.end(readFileSync('public/demo/pos-reference.webp'));
  }
  const pages = Object.values(snap.pages)
    .filter((p): p is PageDoc => !!p)
    .map((p) => ({
      ...p,
      site: state.foreign && p.slug === 'features' ? 'fixture-site-b' : 'fixture-site-a',
      ...(p.slug === 'home'
        ? {
            hero: {
              ...p.hero,
              richText: rich(state.title, 'A CMS edit without a theme release.', 'h1'),
            },
          }
        : {}),
      ...(p.slug === 'features'
        ? {
            _status: state.draft ? ('draft' as const) : ('published' as const),
            slug: state.renamed ? 'ویژگی‌های-تازه' : p.slug,
            title: state.missingEnglish && locale === 'en' ? '' : p.title,
          }
        : {}),
    }));
  pages.push({
    id: 'fixture-unbound',
    slug: 'درباره',
    title: locale === 'en' ? 'An unbound page' : 'یک صفحهٔ مستقل',
    _status: 'published',
    site: 'fixture-site-a',
    hero: { richText: rich(locale === 'en' ? 'An unbound page' : 'یک صفحهٔ مستقل', '', 'h1') },
    layout: [],
  });
  if (url.pathname === '/api/pages') {
    let docs = pages;
    const slug = url.searchParams.get('where[slug][equals]');
    if (slug) docs = docs.filter((p) => p.slug === slug);
    if (url.searchParams.get('where[_status][equals]') === 'published')
      docs = docs.filter((p) => p._status === 'published');
    return json({ docs, hasNextPage: false });
  }
  if (url.pathname.startsWith('/api/pages/')) {
    const p = pages.find((p) => p.id === url.pathname.split('/').pop());
    return json(p ?? {}, p ? 200 : 404);
  }
  if (url.pathname === '/api/posts') return json({ docs: [], hasNextPage: false });
  return json({ error: 'not_found' }, 404);
});
server.listen(PORT, '127.0.0.1', () =>
  console.log(`Local CMS/CRM contract fixture ready on 127.0.0.1:${PORT}`),
);
