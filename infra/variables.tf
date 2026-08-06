variable "project_id" {
  description = "GCP project id"
  type        = string
}

variable "region" {
  description = "Region for Cloud Run, Artifact Registry, Firestore and the assets bucket"
  type        = string
  default     = "us-central1"
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

variable "origin" {
  description = "Public origin the app is served from"
  type        = string
  default     = "https://zaki.gg"
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
  description = "Custom domain to map to the Cloud Run service (empty to skip). The domain must be verified first: gcloud domains verify <domain>"
  type        = string
  default     = ""
}
