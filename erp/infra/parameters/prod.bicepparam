// CloudERP — Production environment parameters
// Usage: az deployment group create -g rg-clouderp-prod -f infra/main.bicep -p infra/parameters/prod.bicepparam

using '../main.bicep'

param env = 'prod'
param location = 'eastus2'
param suffix = 'prod001'   // Change to a unique value per deployment

// !! NEVER commit real secrets — supply via GitHub Secrets / Key Vault in CI !!
param postgresAdminPassword = ''    // Supplied by GitHub Secret: POSTGRES_ADMIN_PASSWORD

param apimPublisherEmail = 'platform@company.com'
param imageTag = 'latest'   // Overridden by CI pipeline with actual image tag

// Populate after first deploy:
// az webapp show -g rg-clouderp-prod -n app-clouderp-prod-prod001 --query outboundIpAddresses -o tsv | tr ',' '\n'
param appServiceOutboundIPs = []

// Add production admin AAD object IDs for Key Vault management
param adminObjectIds = []

param enablePostgresHA = true    // Zone-redundant HA in prod
