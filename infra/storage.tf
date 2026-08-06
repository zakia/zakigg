resource "google_storage_bucket" "note_assets" {
  name                        = "${var.project_id}-note-assets"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  depends_on = [google_project_service.services]
}
