# Verification

## GitHub / Netlify conversion

- Production `next build --webpack` passes, including TypeScript, static pages and dynamic admin/API routes.
- 28 tests pass: the 14 service scenarios against SQLite and again against PostgreSQL via PGlite and the committed Netlify migration.
- Tests include PIN validation and lockout, clock-in/out, concurrent duplicate requests, London DST/overnight hours, admin permissions and sessions, browser approval/revocation/expiry, corrections, audit immutability and CSV safety.
- PostgreSQL uses a GiST exclusion constraint for overlapping shifts, a unique open-shift index, transactional session consumption and immutable audit triggers.
- Legacy Cloudflare build tooling, secrets, local databases and generated output are excluded from GitHub.

Not yet verified: deployment to the user's Netlify account, database provisioning there, its live backup/restore process, or true distributed load. PGlite exercises PostgreSQL semantics but does not simulate multiple networked Postgres connections. Browser approval is explicitly not hardware-bound device identity. Existing local records have not been migrated.

## Netlify login origin regression

Four additional origin tests pass, covering an internal function URL with a public site origin, exact preview URLs, local same-origin use, and rejection of unrelated origins and forged forwarding headers. Production build and TypeScript pass. The fix reads trusted Netlify runtime URLs and embeds only public deploy origins at build time. Live login still needs verification after Netlify deploys the commit.

## Hosted database/login setup diagnostics

The live site reproduced a 503 after the origin fix. The database factory now uses Netlify's native pool selection (including its serverless driver) and preserves explicit local Postgres support. Safe errors distinguish missing/invalid admin configuration, missing database tables and connection failures without disclosing SQL or secrets. All 34 existing/error-reporting scenarios plus the database-driver selection test pass (35 total); production build and TypeScript pass. This does not by itself verify the deployed account's environment variables or migrations.
