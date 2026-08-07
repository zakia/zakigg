# Runtime identity for the Cloud Run service (Firestore + GCS via ADC, no keys)
resource "google_service_account" "app_runtime" {
  account_id   = "app-runtime"
  display_name = "Cloud Run runtime for ${var.service_name}"
}

resource "google_project_iam_member" "app_runtime_datastore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.app_runtime.email}"
}

resource "google_storage_bucket_iam_member" "app_runtime_assets" {
  bucket = google_storage_bucket.note_assets.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app_runtime.email}"
}

# Deploy identity assumed by GitHub Actions through Workload Identity Federation
resource "google_service_account" "github_deployer" {
  account_id   = "github-deployer"
  display_name = "GitHub Actions deployer"
}

resource "google_project_iam_member" "deployer_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_deployer.email}"
}

resource "google_project_iam_member" "deployer_ar_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_deployer.email}"
}

# Allows the deployer to deploy revisions that run as the runtime SA
resource "google_service_account_iam_member" "deployer_acts_as_runtime" {
  service_account_id = google_service_account.app_runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_deployer.email}"
}
