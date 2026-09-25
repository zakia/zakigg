variable "project_id" {
  description = "GCP project id"
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run, Artifact Registry and the assets bucket"
  type        = string
  default     = "us-east1"
}

variable "service_name" {
  description = "Cloud Run service name"
  type        = string
  default     = "zakigg"
}

variable "github_repo" {
  description = "GitHub repository allowed to deploy, in 'owner/name' form"
  type        = string
}

variable "github_client_id" {
  description = "GitHub App client id used as the CMS JWT issuer"
  type        = string
}

variable "github_installation_id" {
  description = "Installation id for the GitHub App on github_repo"
  type        = string
}

variable "github_content_branch" {
  description = "Branch receiving Markdown commits from the CMS"
  type        = string
  default     = "main"
}

variable "custom_domain" {
  description = "Custom domain served by Firebase Hosting in front of Cloud Run (empty to skip)"
  type        = string
  default     = "zaki.gg"
}

variable "hosting_site_id" {
  description = "Globally unique Firebase Hosting site id; defaults to the GCP project id"
  type        = string
  default     = ""
}
