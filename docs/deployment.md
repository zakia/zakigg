# Google Cloud deployment and Notes sync

The SvelteKit app runs on Cloud Run in `us-east1`. Artifact Registry stores the
container image, a named Firestore database stores note metadata and the ordered
sync change log, and a private Cloud Storage bucket stores complete note bodies and assets.
Firebase Hosting is the stable HTTPS/custom-domain front door and forwards all
requests to Cloud Run.

IndexedDB remains the immediate local store. Editing never waits for the
network; signed-in devices push and pull in the background.

## What is automatic and what is manual

Terraform manages the Google APIs, Artifact Registry, Cloud Run, Firestore,
the weekly Firestore backup schedule, Cloud Storage, Firebase Hosting, the
custom-domain association, service accounts, IAM, Secret Manager, and GitHub
Workload Identity Federation.

Two operations remain manual:

1. Creating the Google Identity Services OAuth web client in Cloud Console.
2. Adding the DNS records Terraform receives from Firebase at the domain
   registrar. Terraform deliberately does not manage the registrar account.

## 1. Prerequisites

Install and authenticate these tools:

```sh
gcloud auth login
gcloud auth application-default login
gh auth login
terraform version
```

Create or select a billing-enabled GCP project. The active runtime uses the Tier 1
`us-east1` region for Cloud Run, Firestore, Cloud Storage, and Artifact Registry.
The original Toronto resources and Terraform state remain intact as a rollback
copy after the migration.

## 2. Create the Google sign-in client

In Google Cloud Console, open **Google Auth Platform → Clients**, create a
**Web application** client, and add these Authorized JavaScript origins:

- `https://zaki.gg`
- `https://YOUR_HOSTING_SITE_ID.web.app`
- `http://localhost:5173`

The default Hosting site id is the GCP project id. No redirect URI or client
secret is required because the app uses the Google Identity Services popup and
verifies its ID token on the server.

Copy the client id ending in `.apps.googleusercontent.com`.

## 3. Configure and bootstrap Terraform

```sh
cp infra/terraform.tfvars.example infra/terraform.tfvars
```

Fill in the project id, allowed Google email, OAuth client id, GitHub repository,
and—if the project id is not available as a globally unique Hosting site id—a
different `hosting_site_id`.

Then run:

```sh
./scripts/bootstrap.sh
```

The script performs five ordered operations:

1. Creates a private, versioned Terraform-state bucket.
2. Initializes Terraform and creates the Secret Manager container.
3. Generates the session-signing secret outside Terraform state.
4. Applies the complete infrastructure.
5. Adds the non-secret GitHub Actions variables used by CI.

Infrastructure changes stay explicit: CI checks Terraform formatting and
validity, while `terraform apply` runs from an authenticated administrator's
machine. The GitHub deployment identity therefore cannot change project-wide
IAM, databases, storage, or domain configuration.

The first Terraform apply creates Cloud Run with Google's hello image. That is
only a bootstrap revision; the application workflow replaces it with the real
image.

## 4. Deploy without touching DNS

Push the branch through `main`, or run the **Deploy** GitHub workflow manually.
The workflow checks and builds the app, pushes an immutable commit-tagged image
to Artifact Registry, deploys it to Cloud Run, and calls `/healthz`.

Get both preview addresses:

```sh
terraform -chdir=infra output -raw service_url
terraform -chdir=infra output -raw hosting_preview_url
```

Before changing DNS, verify both URLs:

- `/healthz` returns `{"ok":true}`.
- `/crafts?edit` loads normally.
- Google sign-in works on the `web.app` URL.
- A local note can be created and remains after a reload.
- The browser shows a registered service worker.

## 5. Connect `zaki.gg` without downtime

First print the records requested by Firebase:

```sh
terraform -chdir=infra apply -refresh-only
terraform -chdir=infra output -json domain_dns_records
```

The output can contain two classes of records:

- A TXT ownership/certificate-verification record.
- A/AAAA serving records that direct traffic to Firebase Hosting.

Use this cutover sequence:

1. Record the site's current A, AAAA, and CNAME values so rollback is one DNS
   edit away. Lower their TTL to about 300 seconds at least one TTL before the
   cutover when practical.
2. Add the requested ownership/certificate TXT records first. Do **not** remove
   the current serving records yet; the existing site remains live while
   Firebase verifies domain control. The certificate can remain pending until
   the serving records point at Firebase.
3. Wait for DNS propagation, then run the refresh/output commands again. The
   custom-domain resource is configured not to block Terraform while DNS is
   still pending.
4. Confirm the Cloud Run and `web.app` previews still pass the checks above.
5. Replace only the old A/AAAA/CNAME serving records with Firebase's requested
   serving records. Keep the TXT verification record.
6. Verify `https://zaki.gg/healthz`, `/crafts?edit`, Google sign-in, the manifest,
   and the service worker from a clean browser profile and the installed PWA.

Rollback is simply restoring the old serving records. Firestore and Cloud
Storage remain untouched, so no note data is rolled back or discarded.

## 6. First sync and multi-device test

Open `/crafts?edit`, sign in with the allowlisted Google account, and wait for the
cloud indicator to show synced. Existing local records are enrolled on first
sign-in. Complete note bodies and binary assets go to Cloud Storage; Firestore
only holds metadata, version pointers, tombstones, and the change log.

Test from a second browser profile or phone:

1. Sign in and confirm the first device's notes appear.
2. Go offline, edit a note, and confirm it still reads **Saved locally**.
3. Reconnect or foreground the app and confirm it becomes **Synced**.
4. Delete a test note and confirm the deletion reaches the second device.
5. Add an image and confirm the asset downloads on the second device.
6. Open a previously visited note with the phone offline to verify the cached
   PWA shell and IndexedDB data.

Mobile browsers do not guarantee execution while an installed PWA is fully
closed. Pending changes sync after the app reopens, reconnects, or returns to
the foreground.

## Local development

```sh
bun run dev
```

The dev command reads the non-secret project, bucket, allowlisted email, and
OAuth client id from the deployed Cloud Run service. It generates a separate
session-signing key in memory for each dev-server process; the production key
remains in Secret Manager. Application Default Credentials provide Firestore
and Storage access, so run `gcloud auth application-default login` once if
needed.

Use `bun run dev:local` to bypass Cloud Run discovery and provide configuration
through a local `.env`. For Firestore-only local work,
`FIRESTORE_EMULATOR_HOST` can point the server client at the emulator; use a
disposable GCS bucket for asset tests.

## Recovery and protection

- Firestore has deletion protection and a weekly backup retained for 14 weeks.
- Cloud Storage has public access prevention and object versioning; replaced or
  deleted asset generations remain recoverable for 90 days.
- Every uploaded note body is immutable and hash-checked when downloaded.
- Losing concurrent note revisions are retained in Cloud Storage and recorded
  in Firestore's `revisions` collection rather than silently discarded.
- Cloud Run scales to zero and is capped at two instances for cost control.
