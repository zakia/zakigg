#!/usr/bin/env bash
# One-shot (and idempotent) bootstrap for the GCP deployment.
#
# Automates everything that can be automated:
#   1. Terraform state bucket (chicken-and-egg, so created here, not in TF)
#   2. Terraform init + Secret Manager containers
#   3. Session secret generation (only if no version exists yet)
#   4. GitHub App private-key upload (only if no version exists yet)
#   5. Full Terraform apply
#   6. GitHub Actions repository variables
#
# Prereqs: gcloud (authed), terraform, gh (authed), openssl.
# Usage: GITHUB_APP_PRIVATE_KEY_FILE=/path/to/app.private-key.pem ./scripts/bootstrap.sh

set -euo pipefail

cd "$(dirname "$0")/.."
INFRA_DIR=infra
TFVARS="$INFRA_DIR/terraform.tfvars"
SECRET_NAME=notes-session-secret
GITHUB_SECRET_NAME=github-app-private-key
ADMIN_SECRET_NAME=admin-password
GITHUB_KEY_FILE=${GITHUB_APP_PRIVATE_KEY_FILE:-}

if [[ ! -f "$TFVARS" ]]; then
  echo "error: $TFVARS not found — copy $INFRA_DIR/terraform.tfvars.example and fill it in" >&2
  exit 1
fi

tfvar() {
  awk -F'"' "/^[[:space:]]*$1[[:space:]]*=/ {print \$2}" "$TFVARS"
}

PROJECT_ID=$(tfvar project_id)
GITHUB_CLIENT_ID=$(tfvar github_client_id)
GITHUB_INSTALLATION_ID=$(tfvar github_installation_id)
REGION=$(tfvar region)
STATE_BUCKET="${PROJECT_ID}-tfstate"
REGION=${REGION:-northamerica-northeast2}

if [[ -z "$PROJECT_ID" ]]; then
  echo "error: project_id missing from $TFVARS" >&2
  exit 1
fi
if [[ -z "$GITHUB_CLIENT_ID" || "$GITHUB_CLIENT_ID" == "Iv1.example" ]]; then
  echo "error: github_client_id in $TFVARS is missing or still the example value." >&2
  exit 1
fi
if [[ -z "$GITHUB_INSTALLATION_ID" || "$GITHUB_INSTALLATION_ID" == "12345678" ]]; then
  echo "error: github_installation_id in $TFVARS is missing or still the example value." >&2
  exit 1
fi

echo "==> Project: $PROJECT_ID"
gcloud config set project "$PROJECT_ID" --quiet

echo "==> 1/6 Terraform state bucket gs://$STATE_BUCKET"
if ! gcloud storage buckets describe "gs://$STATE_BUCKET" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$STATE_BUCKET" --location="$REGION" --uniform-bucket-level-access --public-access-prevention
  gcloud storage buckets update "gs://$STATE_BUCKET" --versioning
else
  echo "    already exists, skipping"
fi

echo "==> 2/6 terraform init + secret containers"
terraform -chdir="$INFRA_DIR" init -input=false -reconfigure -backend-config="bucket=$STATE_BUCKET"
terraform -chdir="$INFRA_DIR" apply \
  -target=google_secret_manager_secret.session_secret \
  -target=google_secret_manager_secret.github_app_private_key

echo "==> 3/6 Session secret value ($SECRET_NAME)"
if [[ -z "$(gcloud secrets versions list "$SECRET_NAME" --limit=1 --format='value(name)' 2>/dev/null)" ]]; then
  openssl rand -base64 32 | gcloud secrets versions add "$SECRET_NAME" --data-file=-
  echo "    new secret version added"
else
  echo "    a version already exists, skipping"
fi

echo "==> 4/6 GitHub App private key ($GITHUB_SECRET_NAME)"
if [[ -z "$(gcloud secrets versions list "$GITHUB_SECRET_NAME" --limit=1 --format='value(name)' 2>/dev/null)" ]]; then
  if [[ -z "$GITHUB_KEY_FILE" || ! -f "$GITHUB_KEY_FILE" ]]; then
    echo "error: set GITHUB_APP_PRIVATE_KEY_FILE to the downloaded GitHub App PEM." >&2
    exit 1
  fi
  gcloud secrets versions add "$GITHUB_SECRET_NAME" --data-file="$GITHUB_KEY_FILE"
  echo "    private-key version added"
else
  echo "    a version already exists, skipping"
fi

echo "==> 4.5/6 Admin password ($ADMIN_SECRET_NAME)"
if [[ -z "$(gcloud secrets versions list "$ADMIN_SECRET_NAME" --limit=1 --format='value(name)' 2>/dev/null)" ]]; then
  if [[ -z "$ADMIN_PASSWORD" ]]; then
    echo "error: set ADMIN_PASSWORD to add the admin password secret." >&2
    exit 1
  fi
  printf '%s' "$ADMIN_PASSWORD" | gcloud secrets versions add "$ADMIN_SECRET_NAME" --data-file=-
  echo "    admin password version added"
else
  echo "    a version already exists, skipping"
fi

echo "==> 5/6 Full infrastructure apply"
terraform -chdir="$INFRA_DIR" apply

echo "==> 6/6 GitHub Actions repo variables"
WIF_PROVIDER=$(terraform -chdir="$INFRA_DIR" output -raw wif_provider)
DEPLOYER_SA=$(terraform -chdir="$INFRA_DIR" output -raw deployer_service_account)
gh variable set GCP_PROJECT_ID --body "$PROJECT_ID"
gh variable set WIF_PROVIDER --body "$WIF_PROVIDER"
gh variable set DEPLOYER_SA --body "$DEPLOYER_SA"

echo
echo "Done. Next:"
echo "  - push to main (or run the Deploy workflow) for the first deploy"
echo "  - open the DNS instructions produced by Firebase Hosting:"
echo "      terraform -chdir=$INFRA_DIR output -json domain_dns_records"
echo "  - add those TXT/A/AAAA records at the registrar only after the"
echo "    Cloud Run URL and Firebase preview URL have both passed smoke tests"
