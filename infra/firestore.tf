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

resource "google_firestore_database" "us_east1" {
  name                    = var.target_firestore_database_id
  location_id             = var.target_region
  type                    = "FIRESTORE_NATIVE"
  delete_protection_state = "DELETE_PROTECTION_ENABLED"
  deletion_policy         = "ABANDON"

  depends_on = [google_project_service.services]
}

resource "google_firestore_backup_schedule" "weekly_us_east1" {
  project   = var.project_id
  database  = google_firestore_database.us_east1.name
  retention = "8467200s"

  weekly_recurrence {
    day = "SUNDAY"
  }
}
