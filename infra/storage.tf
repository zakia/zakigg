resource "google_storage_bucket" "note_assets_us_east1" {
  name                        = "${var.project_id}-note-assets-${var.region}"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  versioning {
    enabled = true
  }
  lifecycle_rule {
    condition {
      days_since_noncurrent_time = 90
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.services]
}
