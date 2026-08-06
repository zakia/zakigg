output "service_url" {
  value = google_cloud_run_v2_service.app.uri
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
  description = "DNS records to create at the registrar for the custom domain"
  value       = try(google_cloud_run_domain_mapping.app[0].status[0].resource_records, [])
}
