output "service_url" {
  value = google_cloud_run_v2_service.app.uri
}

output "target_service_url" {
  value = google_cloud_run_v2_service.app_us_east1.uri
}

output "target_artifact_repository" {
  value = "${var.target_region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app_us_east1.repository_id}"
}

output "artifact_repo" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
}

output "wif_provider" {
  description = "Full resource name for google-github-actions/auth workload_identity_provider"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_service_account" {
  value = google_service_account.github_deployer.email
}

output "domain_dns_records" {
  description = "Firebase Hosting ownership and serving DNS records to create at the registrar"
  value = var.custom_domain == "" ? null : {
    required_dns_updates = try(google_firebase_hosting_custom_domain.app[0].required_dns_updates, null)
    cert_verification    = try(google_firebase_hosting_custom_domain.app[0].cert[0].verification, null)
  }
}

output "hosting_preview_url" {
  value = google_firebase_hosting_site.app.default_url
}
