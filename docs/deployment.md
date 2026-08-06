# Deployment & Notes Sync Runbook

The app deploys to **Google Cloud Run** as a container (adapter-node, `Dockerfile`),
with all infrastructure in Terraform under `infra/`. Notes sync uses **Firestore**
(page/asset metadata + tombstones) and a **GCS bucket** (asset blobs), accessed by
the Cloud Run service account via ADC — no key files anywhere.

## One-time bootstrap

Only **one** step is genuinely manual — creating the OAuth client (Google has
no public API for non-IAP OAuth web clients; the IAP-scoped API produces
clients that don't work for Google Sign-In). Everything else is scripted.

1. **Create the GCP project** (or pick an existing one) and note the project id.

2. **OAuth client** (console-only): GCP console → APIs & Services →
   Credentials → Create OAuth client ID → _Web application_.
   - Authorized JavaScript origins: `https://zaki.gg` and `http://localhost:5173`
   - No redirect URIs needed (Google Identity Services popup flow) and the
     client secret is unused — sync only verifies ID tokens against the client id.
   - Consent screen: External; publish it (the server allowlists a single email
     anyway via `NOTES_SYNC_ALLOWED_EMAIL`).

3. **Fill in tfvars and run the bootstrap script** (needs `gcloud`, `terraform`,
   `gh`, all authed):

   ```sh
   cp infra/terraform.tfvars.example infra/terraform.tfvars   # project id, repo, client id
   ./scripts/bootstrap.sh
   ```

   The script is idempotent and does: state bucket → `terraform init` +
   `apply` → session secret (generated, never enters TF state) → GitHub Actions
   repo variables (`GCP_PROJECT_ID`, `WIF_PROVIDER`, `DEPLOYER_SA` — none are
   secret thanks to Workload Identity Federation).

4. **First deploy**: push to `main` (or run the _Deploy_ workflow manually).
   CI builds the image, pushes it to Artifact Registry, and swaps the Cloud Run
   image; all other service config stays in Terraform.

5. **Domain** (optional, Terraform-managed): verify ownership once with
   `gcloud domains verify zaki.gg`, set `custom_domain = "zaki.gg"` in
   `infra/terraform.tfvars`, re-run `./scripts/bootstrap.sh`, then create the
   DNS records shown by `terraform -chdir=infra output domain_dns_records` at
   the registrar.

## Local development

```sh
cp .env.example .env                      # fill in project id, bucket, client id, secret
gcloud auth application-default login     # ADC for Firestore + GCS
pnpm dev
```

Optional: run against the Firestore emulator instead of the real project by
starting `gcloud emulators firestore start --host-port=localhost:8484` and
uncommenting `FIRESTORE_EMULATOR_HOST` in `.env` (the client libraries switch
automatically).

## How sync works (short version)

- IndexedDB stays the source of truth; the editor saves locally exactly as
  before. Sidecar stores (`syncState`, `tombstones`, `syncMeta`) track what
  needs pushing — see `src/lib/notes/sync/`.
- The engine (`engine.svelte.ts`) debounces after each local mutation, and also
  syncs on `online`, tab-visible, sign-in, and a 60s interval. Push sends dirty
  records + tombstones; pull pages through server changes using a
  server-assigned cursor. Conflicts resolve last-write-wins by `updatedAt`
  (larger id breaks ties), symmetric on server and client; a newer edit beats
  an older delete.
- Only the allowlisted Google account can sync (`sync.remote.ts` verifies the
  GIS ID token, then a signed 30-day session cookie). Anonymous visitors keep
  purely local notes; the sync UI just doesn't engage.
- Asset blobs are proxied through `/notes/sync/assets/[id]` to GCS. Cloud Run
  caps request bodies at 32 MB, which bounds asset size.
- Notes whose Tiptap JSON exceeds ~900 KB stay local-only (Firestore doc limit)
  and are reported in the engine's `oversizedPageIds`.
