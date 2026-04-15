// CloudERP — Development environment parameters
// Usage: az deployment group create -g rg-clouderp-dev -f infra/main.bicep -p infra/parameters/dev.bicepparam

using '../main.bicep'

param env = 'dev'
param location = 'eastus2'
param suffix = 'dev001'    // Change to a unique value per deployment

// !! Set these via --parameters flag or Key Vault reference in CI !!
param postgresAdminPassword = ''    // Override: az deployment group create ... --parameters postgresAdminPassword='...'

param apimPublisherEmail = 'devops@company.com'
param imageTag = 'latest'
param adminObjectIds = []           // Add dev team AAD object IDs
param appServiceOutboundIPs = []    // Populate after first deploy: az webapp show --query outboundIpAddresses
param enablePostgresHA = false      // No HA in dev
