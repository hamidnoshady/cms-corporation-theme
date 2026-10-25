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
   Confirm correct preview origin, noindex, the local health check and CMS readiness.
5. Run `SMOKE_ORIGIN=<preview-origin> pnpm smoke`. Review 360/768/1024/1440 widths,
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
   production smoke and field performance monitoring; retain the prior artifact.
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
