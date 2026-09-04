variable "project_id" {
  description = "GCP project id"
  type        = string
}

variable "region" {
  description = "Legacy Toronto region retained during and after the data-safe migration"
  type        = string
  default     = "northamerica-northeast2"
}

variable "target_region" {
  description = "Tier 1 region for the replacement Cloud Run, Firestore, Artifact Registry and assets bucket"
  type        = string
  default     = "us-east1"
}

variable "active_region" {
  description = "Cloud Run region receiving Firebase Hosting traffic"
  type        = string
  default     = "northamerica-northeast2"

  validation {
    condition     = contains([var.region, var.target_region], var.active_region)
    error_message = "active_region must be either region or target_region."
  }
}

variable "target_firestore_database_id" {
  description = "Named Firestore database used by the replacement service"
  type        = string
  default     = "zakigg"
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
