# Deployment and content storage

The application runs on Cloud Run behind Firebase Hosting. Crafts, user accounts, and binary assets
are persisted in the private Google Cloud Storage bucket (`GCS_BUCKET`), while published crafts and
accounts are served from an in-memory KV store for zero-latency reads.

## Storage layout (`GCS_BUCKET`)

All objects live in the private GCS bucket (`public_access_prevention = "enforced"`, accessed only
by the Cloud Run runtime service account via Application Default Credentials):

- `content/crafts/*.md` — Markdown craft documents written with `ifGenerationMatch` preconditions.
- `content/crafts/tags.json` — Tag color registry.
- `content/crafts/deleted.json` — Deleted craft IDs so removed bundled crafts stay deleted.
- `auth/users.json` — Multi-user accounts with `scrypt` password hashes.
- `assets/*` — Binary media assets streamed through `/media/<asset-id>` and `/api/assets/<asset-id>`.

In local development (`dev`), crafts read and write directly to `content/crafts/*.md` and
`src/lib/crafts/tags.json` on disk.

## Administrator authentication

Configure:

```text
ADMIN_PASSWORD
AUTH_SESSION_SECRET
GCS_BUCKET
```

`ADMIN_PASSWORD` and `AUTH_SESSION_SECRET` are provisioned in Google Cloud Secret Manager and
injected into Cloud Run via `infra/cloudrun.tf`. Signing in issues a signed `__session` cookie
verified via HMAC-SHA256. In development, an unset `ADMIN_PASSWORD` auto-signs-in as admin;
production always requires a password.

## Verification

Run:

```sh
bun run check
bun run test
bun run build
terraform -chdir=infra fmt -check
```
