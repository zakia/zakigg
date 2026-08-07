resource "google_firestore_database" "default" {
  name                    = "(default)"
  location_id             = var.region
  type                    = "FIRESTORE_NATIVE"
  delete_protection_state = "DELETE_PROTECTION_ENABLED"
  deletion_policy         = "ABANDON"

  depends_on = [google_project_service.services]
}

resource "google_firestore_backup_schedule" "weekly" {
  project   = var.project_id
  database  = google_firestore_database.default.name
  retention = "8467200s"

  weekly_recurrence {
    day = "SUNDAY"
  }
}
