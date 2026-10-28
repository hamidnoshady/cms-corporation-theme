# Commercial integration contracts

## 1. Biza Miz lead handoff — implemented against an existing endpoint

Source inspected: `hamidnoshady/biza-miz` commit
`619d011b839c9cfc4ca7b39f7d88a8f4e605a3c3`,
`src/app/api/website/leads/route.ts` and
`docs/features/platform-company-workspace.md#website-lead-intake`.

The sales operator creates a show-once **website credential** in Biza Miz's
company Websites area. Set these as encrypted tenant environment values:

- `BIZAMIZ_LEAD_WEBHOOK_URL`: the approved origin's `/api/website/leads`.
- `BIZAMIZ_LEAD_TOKEN`: that site credential (not an owner login/session).
- `LEAD_FORM_SECRET`: random secret; if omitted, a namespaced
  `ESHOBE_REVALIDATE_SECRET` signs challenges.

The browser calls only relative `/api/leads/challenge` and `/api/leads`.
The server sends:

```text
POST <configured lead URL>
Authorization: Bearer <website credential>
Idempotency-Key: <signed challenge nonce>
Content-Type: application/json
```

Body: `name`, normalized `phone`, optional `email`, `message`, allowlisted `source`
(UTM values, referrer origin only, landing path, locale, form ID, lead reference),
and `consent: { contact: true, marketing: false, timestamp, policyVersion }`.
No browser `siteId`, tenant, destination URL or bearer header is forwarded.

Success requires **2xx + `{ accepted: true, id: string }`**. A malformed 2xx is
not success. Timeouts and 502/503/504 retry once with the **same** idempotency key.
Biza Miz durably deduplicates by business + site key + idempotency key and rate
limits the credential. Client retries reuse the challenge nonce. Inputs stay in
memory on errors; the UI never stores names/phones in localStorage or analytics.

Defence in depth: JSON content type, same-origin check, bounded streamed body,
server validation, Unicode digit normalization, consent, signed challenge
(1.5 second minimum age, one-hour expiry), honeypot, per-client/global limits,
no redirects to unknown upstreams, network deadlines. Do not blindly trust
`X-Forwarded-For`. Only set `APEX_TRUSTED_IP_HEADER` when the edge overwrites it
and no direct-origin bypass is available. Local limits are per process; retain
the edge/WAF and Biza Miz's durable limits for a multi-instance deployment.

**Live gate:** submit a consented test lead from the Eshobe preview; verify one
CRM record and retry without duplication; then remove that test record through
the normal sales process. These tests have not contacted a real sales service.

## 2. Published pricing — adapter, not an invented public Biza Miz API

The inspected Biza Miz billing endpoints require owner permissions and can
include subscriptions, balances and charges. They are **not** safe public
marketing feeds. Do not expose them or scrape a logged-in billing page.

Set `BIZAMIZ_CATALOGUE_URL` (and, if required, `BIZAMIZ_CATALOGUE_TOKEN`) only to
an operator-approved published export matching the following **adapter schema**.
The publishing adapter/export must be supplied by Biza Miz; this repository does
not claim that this URL already exists in production.

```ts
type PublishedCatalogueV1 = {
  version: 1
  sourceUrl: string                  // HTTPS public explanation, not a private API
  publishedAt: string              // ISO timestamp
  validUntil: string               // required, at most 7 days after publishedAt
  taxNote: { fa: string; en: string }
  plans: Array<{
    id: string
    name: { fa: string; en: string }
    amountMinor: number            // non-negative SAFE INTEGER
    currency: 'IRR' | 'IRT' | 'USD' | 'EUR'
    period: { fa: string; en: string } // e.g. per approved billing basis
    description?: { fa: string; en: string }
    features?: Array<{ fa: string; en: string }>
  }>
}
```

Do not copy fictitious sample prices into this feed. Biza Miz stores money in
integer Rial: if the export says `IRR`, send Rial; never label that number `IRT`.
An intentional conversion must use the upstream money helper. The renderer uses
`formatPrice` and shows tax disclosure, source link and update date. Cache TTL is
five minutes; expired/invalid/missing feed means **no prices**, with an honest
request-a-quote action. CMS `pricing` blocks are always labelled illustrative.
Any activation/setup/enabled-hour/add-on charges and trial/refund conditions must
be explicitly disclosed in published content. Wallet funding is not a licence,
revenue, guaranteed usage duration or a checkout product on this theme.

## 3. Onboarding and analytics

`ownerSignupHref` is an optional CMS setting pointing to the approved Biza Miz
owner onboarding destination. It never creates a local account. Page hero and
CTA links can also be configured by the editor. No guessed signup/payment URL
is baked into the theme.

Set `PLAUSIBLE_DOMAIN` + `PLAUSIBLE_EVENTS_URL` at runtime. Analytics is disabled
in sample and draft-preview mode, and until the visitor opts in. Consent can be
revoked through the footer preferences. Browser event allowlist:
`pageview`, `demo_cta`, `onboarding_click`. `lead_submitted` is sent only by the
server after a confirmed, non-duplicate CRM receipt (and opted-in visitor). Query strings,
contact values, CRM IDs and payment details are never analytics props. The
server transport intentionally does not forward visitor IPs or user agents;
reports are aggregate events, **not reliable unique-visitor attribution**.
Lead source/UTM information stays in the CRM for authorized sales reporting.
Verify the configured collector actually records server-originated traffic; bot/IP
filters can discard it. A reported `X-Plausible-Dropped: 1` is treated as failure.
Do not call a successful HTTP request evidence of an end-to-end funnel report.

Downstream demo/activation/settlement are not inferred from a click. An optional
Biza Miz server-side adapter may call `POST /api/conversions` with:

```ts
{ id: string, event: 'demo_completed' | 'activation' | 'settled_top_up',
  timestamp: string, consent: true, verified: true }
```

Header `X-Apex-Signature: sha256=<HMAC-SHA256(BIZAMIZ_CONVERSION_SECRET, rawBody)>`.
The **body** timestamp is signed and must be within five minutes. Event IDs are
required; exact retries are deduplicated for one day **within a process**.
Concurrent delivery of the same ID requests a retry. No amounts or payment IDs
are needed. Emit `settled_top_up` only from the actual verified settlement path;
never from a gateway return or pending transaction.

**Limit:** this optional callback is this theme's documented adapter interface,
not an existing Biza Miz webhook. It needs an authorized emitter. In-memory
analytics deduplication is not durable across restarts/replicas and is never a
billing ledger or the source of truth for the first-ten-paying-customer goal.
Use Biza Miz's authoritative CRM/activation/payment records for that goal.
