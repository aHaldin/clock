# Verification

## GitHub / Netlify conversion

- Production `next build --webpack` passes, including TypeScript, static pages and dynamic admin/API routes.
- 28 tests pass: the 14 service scenarios against SQLite and again against PostgreSQL via PGlite and the committed Netlify migration.
- Tests include PIN validation and lockout, clock-in/out, concurrent duplicate requests, London DST/overnight hours, admin permissions and sessions, browser approval/revocation/expiry, corrections, audit immutability and CSV safety.
- PostgreSQL uses a GiST exclusion constraint for overlapping shifts, a unique open-shift index, transactional session consumption and immutable audit triggers.
- Legacy Cloudflare build tooling, secrets, local databases and generated output are excluded from GitHub.

Not yet verified: deployment to the user's Netlify account, database provisioning there, its live backup/restore process, or true distributed load. PGlite exercises PostgreSQL semantics but does not simulate multiple networked Postgres connections. Browser approval is explicitly not hardware-bound device identity. Existing local records have not been migrated.
