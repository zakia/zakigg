resource "google_artifact_registry_repository" "app" {
  repository_id = "app"
  format        = "DOCKER"
  location      = var.region
  description   = "Container images for ${var.service_name}"

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "delete-old"
    action = "DELETE"
    condition {
      older_than = "2592000s" # 30 days
    }
  }

  depends_on = [google_project_service.services]
}

resource "google_artifact_registry_repository" "app_us_east1" {
  repository_id = "app"
  format        = "DOCKER"
  location      = var.target_region
  description   = "Container images for ${var.service_name}"

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "delete-old"
    action = "DELETE"
    condition {
      older_than = "2592000s"
    }
  }

  depends_on = [google_project_service.services]
}
