# Partial backend config: the state bucket is created once by hand (chicken-and-egg):
#   gcloud storage buckets create gs://<PROJECT_ID>-tfstate --location=us \
#     --uniform-bucket-level-access && \
#   gcloud storage buckets update gs://<PROJECT_ID>-tfstate --versioning
# Then:
#   terraform init -backend-config="bucket=<PROJECT_ID>-tfstate"
terraform {
  backend "gcs" {
    prefix = "zakigg"
  }
}
