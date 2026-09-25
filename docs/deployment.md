# Deployment and content storage

The application runs on Cloud Run behind Firebase Hosting. Git stores Markdown, GCS stores binary
assets, Google Identity protects the private editor, and a GitHub App performs repository writes.

## GitHub App

Create a GitHub App with:

- Repository access limited to this repository.
- Repository permission: Contents, read and write.
- No user authorization flow or callback URL is required.
- The target branch must allow this App to commit directly.

Install it on the repository and record its app and installation IDs in `infra/terraform.tfvars`.
The bootstrap script creates the secret container and uploads the PEM without putting the value in
Terraform state:

```sh
GITHUB_APP_PRIVATE_KEY_FILE=/absolute/path/to/private-key.pem ./scripts/bootstrap.sh
```

For an existing installation where the rest of Terraform is already applied, create the new secret
container first, upload the key, and then apply normally:

```sh
terraform -chdir=infra apply -target=google_secret_manager_secret.github_app_private_key
gcloud secrets versions add github-app-private-key --data-file=private-key.pem
terraform -chdir=infra apply
```

Terraform provides these runtime values:

- `GITHUB_CLIENT_ID`
- `GITHUB_INSTALLATION_ID`
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH`
- `GITHUB_PRIVATE_KEY` from Secret Manager

The server exchanges the app JWT for a short-lived installation token. GitHub credentials are
never sent to the browser.

## Administrator authentication

Configure:

```text
ADMIN_PASSWORD
AUTH_SESSION_SECRET
```

The admin password is verified server-side and issues the signed `__session` cookie. All Git
commands and GCS uploads check that session and request origin. In development, an unset
`ADMIN_PASSWORD` auto-signs-in as admin; production always requires a password.

## Content build

Published Markdown lives under `content/crafts`. A Git commit starts the normal deployment. The
build imports those files and prerenders public craft routes. Files with `draft: true` are omitted.

The runtime does not contact GitHub when serving public pages. `/media/<asset-id>` streams immutable
objects from the private GCS bucket through the public application route.

## Verification

Run:

```sh
bun run check
bun run test
bun run build
terraform fmt -check infra
```

Then verify Google sign-in, Git save, publish deployment, direct public loading without a session,
asset rendering, and offline reload of previously visited craft pages.
