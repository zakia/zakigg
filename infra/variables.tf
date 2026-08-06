variable "project_id" {
  description = "GCP project id"
  type        = string
}

variable "region" {
  description = "Region for Cloud Run, Artifact Registry, Firestore and the assets bucket"
  type        = string
  default     = "northamerica-northeast2"
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

variable "allowed_email" {
  description = "The single Google account email allowed to use notes sync"
  type        = string
}

variable "google_client_id" {
  description = "OAuth 2.0 Web Client ID used for Google Sign-In (not secret)"
  type        = string
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
