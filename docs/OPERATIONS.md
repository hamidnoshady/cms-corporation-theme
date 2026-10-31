# Deploy, verify, promote, roll back

## Image and configuration

The manifest prefers `registry_image` with
`ghcr.io/hamidnoshady/cms-corporation-theme@sha256:<digest>`. A reusable image
contains no runtime site credentials. Its default process runs as uid 1001,
binds `0.0.0.0:3000`, and its liveness check is local IPv4
`http://127.0.0.1:3000/api/health`. Health never depends on CMS/CRM availability.

The GitHub verification workflow runs static/unit/browser checks and a Docker
container smoke. The publish workflow repeats the gates, builds with provenance
and SBOM, pushes a SHA-labelled image and registers the **digest** with Eshobe.
It never deploys/promotes production automatically.

Repository Actions secrets (enter in GitHub Settings, never in source/chat):
`ESHOBE_CMS_URL`, `ESHOBE_THEME_PACKAGE_ID`, `ESHOBE_THEME_ARTIFACT_SECRET`.
The CMS server must have the matching artifact secret. The package repository,
image repository and strategy must match the manifest. Registration is signed
over the exact raw JSON; retries are idempotent. See `theme-artifacts.md`.

Manifest image visibility is **private**: provision the Coolify GHCR credential
through Eshobe's deploy target. If the operator deliberately makes the package
public, update visibility in both the manifest and target configuration. Do not
assume GitHub source visibility makes GHCR public.

## CMS origin, liveness and CMS readiness

The theme renders server-side, so the container needs a CMS origin it can actually
reach. Eshobe copies its `DEPLOY_CMS_URL` into `ESHOBE_CMS_URL` at deploy time and
the value it recommends is a **proxy-free internal origin** on the shared Docker
network, for example `http://eshobe-cms-web:3000`. Falling back to a public origin
with Host/SNI routing can loop back through the proxy and answer 503.

Accepted shapes for `ESHOBE_CMS_URL` (server-only, never a `NEXT_PUBLIC_*`):

| Value | Accepted | Why |
|---|---|---|
| `https://cms.example.com` | yes | TLS origin; credentials, paths, queries and fragments rejected. |
| `http://eshobe-cms-web:3000` | yes | single-label Docker/Compose service name; it cannot be a public DNS origin. |
| `http://cms.internal:3000`, `http://cms.svc.cluster.local:3000`, `*.local`, `*.docker`, `*.lan`, `*.home.arpa` | yes | reserved private suffixes, never public DNS. |
| `http://10.0.0.12:3000`, `http://172.17.0.2:3000`, `http://192.168.1.20:3000`, `http://[fd00::1]:3000` | yes | private/link-local IP literals (10/8, 172.16/12, 192.168/16, 169.254/16, 100.64/10, fc00::/7, fe80::/10). |
| `http://cms.example.com`, `http://8.8.8.8` | **no** | public plain HTTP stays rejected; use HTTPS. |
| the theme's own public origin (`ESHOBE_PUBLIC_ORIGIN` / `ESHOBE_SITE_DOMAIN`) | **no** — `cms_url_self_origin` | the container would call itself: the self-routing loop this policy exists to prevent. |
| `http://127.0.0.1:3300` / `http://localhost:3000` | only with that exact `APEX_CMS_HTTP_ORIGINS` entry, or locally with `APEX_ALLOW_LOCAL_UPSTREAM=true` | loopback inside the container is the theme itself; a test escape hatch, never a production default. |
| URL with credentials, `?query`, `#fragment` or a path | **no** | the site key must never travel in a URL, and the theme appends `/api/...` itself. |

Anything else internal can be opted in explicitly with
`APEX_CMS_HTTP_ORIGINS=host:port` (exact match, no wildcards, comma-separated).

The policy lives in `src/lib/cms/origin.ts` and applies to every server-only CMS
call (`cmsGet`, `cmsMedia`, the native preview handoff). It is separate from the
stricter shared `serverUrl()` used by the lead, analytics and pricing
integrations, and it never relaxes them. Requests always use the approved origin,
send the site-scoped bearer key only there, refuse redirects, and keep bounded
timeouts (4 s content, 10 s media, 2.5 s readiness).

Every process start also prints one boot line, before any request arrives, so a
misconfigured deployment is diagnosable from container logs alone:

```text
[cms] {"event":"cms_startup","mode":"invalid","origin":"http://bizamiz.eshobe.com",
       "reason":"cms_url_self_origin","configIssue":"cms_url_self_origin",
       "hint":"… Set Eshobe's DEPLOY_CMS_URL to a proxy-free internal CMS origin …"}
```

The reason code is repeated where no log access is needed: `detail` on the thrown
`CmsError` (its message is `CMS request failed (503) [config_invalid:cms_url_self_origin]`),
`configIssue` from the public `GET /api/health` (a code only — never a host), and
`reason` from the authenticated `GET /api/ready`.

A missing, partial or rejected configuration **fails closed**: the theme throws a
typed error and renders its localized fallback. It never falls back to demo
content unless `APEX_DEMO_MODE=true` is explicitly set on a non-production box.
Every failure is logged once per class and window as one sanitized line:

```text
[cms] {"event":"cms_failure","failure":"upstream_unavailable","status":503,
       "upstreamStatus":503,"origin":"http://eshobe-cms-web:3000",
       "path":"/api/site","correlationId":"…","hint":"…"}
```

`failure` distinguishes `config_missing`/`config_invalid`/`key_missing` (rejected
before any request), `dns`/`network`/`timeout`/`redirect`, `auth` (upstream
401/403), `rate_limited`, `upstream_unavailable` (upstream 502/503/504),
`invalid_response`, `contract_mismatch` and `site_mismatch`. A `config_invalid`
always carries a `reason`: `cms_url_malformed`, `cms_url_scheme`,
`cms_url_credentials`, `cms_url_fragment`, `cms_url_query`, `cms_url_path`,
`cms_url_untrusted_http` or `cms_url_self_origin`. Lines never contain
the bearer key, an env value, request headers or an upstream body. Identical
failures are folded for 60 s (`suppressed`) so an outage cannot flood the log, and
the `correlationId` also appears on the thrown error so a Next error digest can be
matched to the diagnostic line.

### Liveness vs readiness

| Endpoint | Scope | Auth | Behaviour |
|---|---|---|---|
| `GET /api/health` | local process only | none | Always `200` with `ok: true` and `mode: cms \| demo \| unconfigured \| invalid`. When invalid it also carries `configIssue` (a rule code such as `cms_url_self_origin`, never a host or a key). Never calls the CMS, so a CMS blip cannot mark every container unhealthy. This is the manifest `build.healthCheckPath` that Coolify probes from inside the container. |
| `GET /api/ready` | real CMS `GET /api/site` | `Authorization: Bearer` equal to `APEX_READY_TOKEN` or `ESHOBE_REVALIDATE_SECRET` (values shorter than 16 characters are ignored) | `200` only when the descriptor answers with `contractVersion: 1`, the matching site id and an active site; otherwise `503` with a sanitized `checks` object, `reason`, hints, latency and correlation id. Coalesced for 2 s; no key, upstream header or body in the response. It is authenticated, so its remediation hint may name the internal host that needs the exact allowlist entry. |

`/api/ready` stays **out** of `healthCheckPath` on purpose. The upstream Theme API
requires the container health check to stay cheap and local: pointing it at a
remote probe marks every container unhealthy during a legitimate CMS restart, and
the promotion probe treats any non-2xx as a failed deploy. Promotion therefore
gates on two checks: the local liveness path (Coolify) **and** an explicit
readiness probe by the operator or the CMS, for example

```sh
SMOKE_ORIGIN=https://<app-host> SMOKE_READY_TOKEN=<token> pnpm smoke
curl -fsS -H "Authorization: Bearer $ESHOBE_REVALIDATE_SECRET" \
  https://<app-host>/api/ready | jq '.ok, .checks'
```

Environment variables are read at container start. Changing `DEPLOY_CMS_URL`,
`APEX_CMS_HTTP_ORIGINS` or any tenant secret reaches running containers only on a
**redeploy** (the CMS reports `needsRedeploy` until then), so a config fix is not
complete until the deployment has been redeployed and `/api/ready` returns 200.

### Diagnosing the "CMS request failed (503)" fallback

1. Call `GET /api/health`. `mode: "invalid"` plus `configIssue` names the rule that
   rejected the configuration without exposing the host, for example
   `{"ok":true,"mode":"invalid","configIssue":"cms_url_self_origin"}`. The same
   code appears in the container's `[cms] {"event":"cms_startup",…}` line and in
   the Next error message as `[config_invalid:cms_url_self_origin]`.
2. On the theme container, print `ESHOBE_CMS_URL` (never the key) and confirm the
   scheme/host matches the table above.
3. From inside the same container call `GET ${ESHOBE_CMS_URL}/api/site` with the
   server-only bearer key and record only the status and content type. A TLS or
   connection error here is a network/proxy dependency; a 401/403 is a key
   problem; a 200 means the theme configuration is the problem.
4. Call `/api/ready` with the deployment token and read `checks`:
   `config` (policy/key), `cms` (`unavailable`, `auth`, `timeout`, `redirect`,
   `unreachable`, `invalid_response`), `contract`, `site`.
5. Match the `correlationId` in the response with the `[cms]` log line; the Next
   error digest next to it is the browser's `Reference:` value.
6. Fix the origin/allowlist/key, redeploy, and re-run readiness plus the two
   locales before promoting.

| `configIssue` | Meaning | Fix |
|---|---|---|
| `cms_url_self_origin` | `ESHOBE_CMS_URL` is this theme's own public origin | set Eshobe's `DEPLOY_CMS_URL` to the internal CMS origin, then redeploy |
| `cms_url_untrusted_http` | public plain-HTTP origin | use HTTPS, or an internal destination from the table above |
| `cms_url_path` / `_query` / `_fragment` / `_credentials` | the value is not a bare origin | strip it: `http://eshobe-cms-web:3000`, no trailing path or auth |
| `cms_url_scheme` / `_malformed` | missing scheme or not a URL | include `http://` or `https://` |
| `cms_url_missing` / `cms_key_missing` | platform variables not injected | fix the Eshobe binding, then redeploy |

## Tenant and cache boundaries

- Each Eshobe binding gets its own container and server-only site key. Allowed
  inbound hosts are `ESHOBE_SITE_DOMAIN`, `ESHOBE_PUBLIC_ORIGIN` and explicit
  operator `APEX_ALLOWED_HOSTS` entries; an unknown host cannot borrow the key.
- API credentials, authorization/cookies from visitors, arbitrary tenant query
  strings and caller-chosen proxy targets are never forwarded.
- The public proxy exposes the sanitized descriptor and media files only.
  Content is rendered server-side with publication/translation/site checks.
- Descriptor cache is bounded, keyed by CMS origin + credential hash, coalesced,
  TTL 30 seconds and maximum stale age 5 minutes. A warm descriptor answers
  immediately while refresh happens; after the stale window a failure is visible.
  Page reads use tagged Next data caching with 30-second revalidation.
- Signed `/api/revalidate` marks the descriptor stale and calls `revalidateTag`.
  No external calls are made by the webhook; maximum body 64 KiB. v1 signs raw
  body only, not the unsigned timestamp header. Site mismatch does not purge.
- Stale-while-revalidate is eventually consistent: the first request after a
  publish/unpublish can still see the previously **published** page. Do not use
  this TTL as immediate erasure; emergency takedowns require purging/restarting
  the relevant binding or disabling it at the edge.
- Stale memory is per container. Multiple replicas need delivery of invalidation
  to each replica/shared cache or must accept the documented TTL window.

## Draft preview (not the same as an Eshobe preview deployment)

Native Eshobe `/next/preview?path=...&previewSecret=...&token=...` is supported.
Set tenant `ESHOBE_PREVIEW_SECRET` equal to the CMS's `PREVIEW_SECRET`. The theme
verifies the editor token with CMS `/api/users/me`, requires platform admin or
owner/editor membership of the deployed site, and redirects immediately to a
validated relative path. Tokens are never logged, stored in browser JS or
forwarded into links. Configure the reverse proxy **not to log query strings on
`/next/preview`**, since the upstream handoff contract puts a short-lived editor
credential in that URL.

The cookie is an HttpOnly, signed grant, bound to one site and exact path, expiring
in five minutes. Production uses Secure/SameSite=None for the CMS iframe. Only
that path can read drafts, with `no-store`; no draft data enters shared caches.
The private banner refreshes while visible. Expiry requires a fresh authorized
handoff. `/next/exit-preview` deletes the grant. A membership revocation may take
up to the five-minute grant lifetime to take effect. Origin/CMS outage fails
closed for new grants. `APEX_ALLOW_LOCAL_UPSTREAM=true` exists solely for local
loopback tests and must not be enabled in live deployments.

A strict nonce CSP can be added at the deployment edge only with the Next inline
script nonce wired end-to-end; a blanket frame block breaks CMS and Arena previews.
Do not add X-Frame-Options DENY/SAMEORIGIN to this embeddable renderer.

## Launch checklist — requires live services and an operator

1. Sync the manifest; configure the Eshobe package, GHCR target and runtime secrets.
2. Publish/bind reviewed content in both languages (including a real privacy
   policy) and current approved product captures. Verify all original claims.
3. Run `node scripts/readiness.mjs` from a securely configured environment.
   This is read-only and prints gate names/booleans, not credentials/content.
4. Register the exact built artifact, then deploy it to **Eshobe preview**.
   Confirm the preview origin, noindex, the local health check (`/api/health`
   returns 200) and CMS readiness (`/api/ready` returns 200 with every check
   `ok`). A green liveness check alone is not readiness.
5. Run `SMOKE_READY_TOKEN=$ESHOBE_REVALIDATE_SECRET SMOKE_ORIGIN=<preview-origin> pnpm smoke`
   (or `pnpm smoke` without a token for the public probes only). Review 360/768/1024/1440 widths,
   fa/en, light/dark, keyboard menu/form/FAQ, announcement, system preference.
6. Edit and publish CMS text without releasing code. Confirm revalidation and
   the published result. Verify an unauthorized/foreign-site draft cannot be read.
7. Perform a consented test lead: verify one real CRM record, validation,
   network retry/idempotency and failure UI. Confirm the actual pricing feed,
   fees/terms and owner onboarding URL with Biza Miz's billing authority.
8. If enabled, verify opt-in metrics and the signed downstream event emitter
   against actual demo/activation/settlement records. Do not invent conversions.
9. Record the **currently running production artifact/digest** as rollback target.
   Promote the reviewed **same** preview artifact through Eshobe. Run read-only
   production smoke including `/api/ready` and field performance monitoring;
   retain the prior artifact.
   If this is the first deployment and no prior digest exists, agree and record
   the supported recovery target with the platform operator before promotion;
   do not invent a previous artifact or mark rollback as verified.
10. Rehearse rollback through Eshobe by selecting that earlier deployment artifact,
    verify the running digest + health + locale pages, and re-promote only after
    approval. Rollback must not rebuild a mutable branch/tag or overwrite tenant
    settings/bindings. Keep evidence in the deployment's operational record.

This sandbox has no Docker daemon or configured Eshobe production/registry/CRM
credentials. The workflow and runbook are implemented; a container smoke,
GHCR callback, real lead receipt, production promotion and rollback are **not**
claimed as executed here. Do not close issue #1 until those live gates are recorded.
