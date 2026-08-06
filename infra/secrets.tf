# Secret containers only — values are added out-of-band so they never enter TF state:
#   openssl rand -base64 32 | gcloud secrets versions add notes-session-secret --data-file=-
resource "google_secret_manager_secret" "session_secret" {
  secret_id = "notes-session-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_iam_member" "app_runtime_session_secret" {
  secret_id = google_secret_manager_secret.session_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app_runtime.email}"
}
