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

# Add the GitHub App PEM out-of-band:
#   gcloud secrets versions add github-app-private-key --data-file=private-key.pem
resource "google_secret_manager_secret" "github_app_private_key" {
  secret_id = "github-app-private-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_iam_member" "app_runtime_github_app_private_key" {
  secret_id = google_secret_manager_secret.github_app_private_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app_runtime.email}"
}

# Admin password for the private editor. Value is added out-of-band so it never
# enters TF state:
#   printf '%s' 'your-password' | gcloud secrets versions add admin-password --data-file=-
resource "google_secret_manager_secret" "admin_password" {
  secret_id = "admin-password"

  replication {
    auto {}
  }

  depends_on = [google_project_service.services]
}

resource "google_secret_manager_secret_iam_member" "app_runtime_admin_password" {
  secret_id = google_secret_manager_secret.admin_password.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app_runtime.email}"
}
