#!/usr/bin/env bash
# One-shot (and idempotent) bootstrap for the GCP deployment.
#
# Automates everything that can be automated:
#   1. Terraform state bucket (chicken-and-egg, so created here, not in TF)
#   2. terraform init + apply
#   3. Session secret generation (only if no version exists yet)
#   4. GitHub Actions repo variables from terraform outputs (via gh CLI)
#
# The ONE remaining manual step is creating the OAuth 2.0 Web Client in the
# console (no public API exists for non-IAP OAuth clients):
#   https://console.cloud.google.com/apis/credentials
#   -> Create OAuth client ID -> Web application
#   -> Authorized JavaScript origins: https://zaki.gg + http://localhost:5173
# Put the client id in infra/terraform.tfvars as google_client_id BEFORE
# running this script.
#
# Prereqs: gcloud (authed), terraform, gh (authed), openssl.
# Usage: ./scripts/bootstrap.sh

set -euo pipefail

cd "$(dirname "$0")/.."
INFRA_DIR=infra
TFVARS="$INFRA_DIR/terraform.tfvars"
SECRET_NAME=notes-session-secret

if [[ ! -f "$TFVARS" ]]; then
  echo "error: $TFVARS not found — copy $INFRA_DIR/terraform.tfvars.example and fill it in" >&2
  exit 1
fi

tfvar() {
  awk -F'"' "/^[[:space:]]*$1[[:space:]]*=/ {print \$2}" "$TFVARS"
}

PROJECT_ID=$(tfvar project_id)
GOOGLE_CLIENT_ID=$(tfvar google_client_id)
STATE_BUCKET="${PROJECT_ID}-tfstate"

if [[ -z "$PROJECT_ID" ]]; then
  echo "error: project_id missing from $TFVARS" >&2
  exit 1
fi
if [[ -z "$GOOGLE_CLIENT_ID" || "$GOOGLE_CLIENT_ID" == *"1234567890"* ]]; then
  echo "error: google_client_id in $TFVARS is missing or still the example value." >&2
  echo "Create the OAuth Web Client first (see comment at the top of this script)." >&2
  exit 1
fi

echo "==> Project: $PROJECT_ID"
gcloud config set project "$PROJECT_ID" --quiet

echo "==> 1/4 Terraform state bucket gs://$STATE_BUCKET"
if ! gcloud storage buckets describe "gs://$STATE_BUCKET" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$STATE_BUCKET" --location=us --uniform-bucket-level-access
  gcloud storage buckets update "gs://$STATE_BUCKET" --versioning
else
  echo "    already exists, skipping"
fi

echo "==> 2/4 terraform init + apply"
terraform -chdir="$INFRA_DIR" init -input=false -backend-config="bucket=$STATE_BUCKET"
terraform -chdir="$INFRA_DIR" apply

echo "==> 3/4 Session secret ($SECRET_NAME)"
if [[ -z "$(gcloud secrets versions list "$SECRET_NAME" --limit=1 --format='value(name)' 2>/dev/null)" ]]; then
  openssl rand -base64 32 | gcloud secrets versions add "$SECRET_NAME" --data-file=-
  echo "    new secret version added"
else
  echo "    a version already exists, skipping"
fi

echo "==> 4/4 GitHub Actions repo variables"
WIF_PROVIDER=$(terraform -chdir="$INFRA_DIR" output -raw wif_provider)
DEPLOYER_SA=$(terraform -chdir="$INFRA_DIR" output -raw deployer_service_account)
gh variable set GCP_PROJECT_ID --body "$PROJECT_ID"
gh variable set WIF_PROVIDER --body "$WIF_PROVIDER"
gh variable set DEPLOYER_SA --body "$DEPLOYER_SA"

echo
echo "Done. Next:"
echo "  - push to main (or run the Deploy workflow) for the first deploy"
echo "  - for the custom domain: gcloud domains verify <domain>, set custom_domain"
echo "    in $TFVARS, re-run this script, then add the DNS records from:"
echo "      terraform -chdir=$INFRA_DIR output domain_dns_records"
