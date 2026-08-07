resource "google_cloud_run_v2_service" "app" {
  name                = var.service_name
  location            = var.region
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = true

  template {
    service_account = google_service_account.app_runtime.email

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    containers {
      # Placeholder for the first apply; CI owns the real image (see ignore_changes)
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "PROTOCOL_HEADER"
        value = "x-forwarded-proto"
      }
      env {
        name  = "HOST_HEADER"
        value = "x-forwarded-host"
      }
      env {
        name  = "BODY_SIZE_LIMIT"
        value = "20M"
      }
      env {
        name  = "NOTES_GCS_BUCKET"
        value = google_storage_bucket.note_assets.name
      }
      env {
        name  = "NOTES_SYNC_ALLOWED_EMAIL"
        value = var.allowed_email
      }
      env {
        name  = "PUBLIC_GOOGLE_CLIENT_ID"
        value = var.google_client_id
      }
      env {
        name = "NOTES_SYNC_SESSION_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.session_secret.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  lifecycle {
    # CI deploys new images with `gcloud run deploy --image`; Terraform must not revert them
    ignore_changes = [template[0].containers[0].image, client, client_version]
  }

  depends_on = [
    google_project_service.services,
    google_secret_manager_secret_iam_member.app_runtime_session_secret,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.app.name
  location = google_cloud_run_v2_service.app.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
