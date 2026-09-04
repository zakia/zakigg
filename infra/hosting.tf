locals {
  hosting_site_id          = var.hosting_site_id != "" ? var.hosting_site_id : var.project_id
  active_cloud_run_service = var.active_region == var.target_region ? google_cloud_run_v2_service.app_us_east1 : google_cloud_run_v2_service.app
}

resource "google_firebase_project" "app" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.services]
}

resource "google_firebase_hosting_site" "app" {
  provider = google-beta
  project  = var.project_id
  site_id  = local.hosting_site_id

  depends_on = [google_firebase_project.app]
}

# Firebase Hosting supplies the production-grade custom-domain/TLS front door.
# Every request is forwarded to the active SvelteKit service on Cloud Run, so
# the PWA keeps one stable origin while regions are migrated safely.
resource "google_firebase_hosting_version" "cloud_run" {
  provider = google-beta
  site_id  = google_firebase_hosting_site.app.site_id

  config {
    rewrites {
      glob = "**"
      run {
        service_id = local.active_cloud_run_service.name
        region     = local.active_cloud_run_service.location
      }
    }
  }
}

resource "google_firebase_hosting_release" "cloud_run" {
  provider     = google-beta
  site_id      = google_firebase_hosting_site.app.site_id
  version_name = google_firebase_hosting_version.cloud_run.name
  message      = "Route zaki.gg to Cloud Run"
}

resource "google_firebase_hosting_custom_domain" "app" {
  provider = google-beta
  count    = var.custom_domain == "" ? 0 : 1

  project               = var.project_id
  site_id               = google_firebase_hosting_site.app.site_id
  custom_domain         = var.custom_domain
  cert_preference       = "GROUPED"
  wait_dns_verification = false
  deletion_policy       = "ABANDON"
}
