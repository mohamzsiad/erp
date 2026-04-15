// ═══════════════════════════════════════════════════════════════════════════════
// CloudERP — Main Bicep Orchestration Template
// Deploy: az deployment group create -g <rg> -f infra/main.bicep -p infra/parameters/prod.bicepparam
// What-if: az deployment group what-if -g <rg> -f infra/main.bicep -p infra/parameters/prod.bicepparam
// ═══════════════════════════════════════════════════════════════════════════════

targetScope = 'resourceGroup'

// ── Parameters ────────────────────────────────────────────────────────────────
@description('Environment: dev or prod')
@allowed(['dev', 'prod'])
param env string = 'dev'

@description('Azure region for resources (e.g. eastus2)')
param location string = resourceGroup().location

@description('Unique suffix to avoid naming conflicts (4-8 chars, alphanumeric)')
@minLength(4)
@maxLength(8)
param suffix string

@description('PostgreSQL admin password')
@secure()
param postgresAdminPassword string

@description('APIM publisher email')
param apimPublisherEmail string

@description('Docker image tag to deploy')
param imageTag string = 'latest'

@description('Admin AAD object IDs for Key Vault access')
param adminObjectIds array = []

@description('App Service outbound IPs (get from az webapp show --query outboundIpAddresses)')
param appServiceOutboundIPs array = []

@description('Enable PostgreSQL HA (zone-redundant)')
param enablePostgresHA bool = env == 'prod'

// ── App Insights (deployed first — needed by App Service) ────────────────────
module appInsights 'modules/appInsights.bicep' = {
  name: 'appInsights-${suffix}'
  params: {
    location: location
    env: env
    suffix: suffix
  }
}

// ── App Service + ACR ─────────────────────────────────────────────────────────
// Note: Key Vault must exist before App Service — we bootstrap with a dummy
// principal ID, then update KV RBAC after App Service is created.
// We use a two-pass deploy: first pass creates App Service, second pass wires KV.
module appService 'modules/appService.bicep' = {
  name: 'appService-${suffix}'
  params: {
    location: location
    env: env
    suffix: suffix
    acrLoginServer: ''    // ACR is created inside appService.bicep
    imageTag: imageTag
    keyVaultUri: keyVault.outputs.keyVaultUri
    appInsightsConnectionString: appInsights.outputs.connectionString
    skuName: env == 'prod' ? 'P2v3' : 'P1v3'
  }
  dependsOn: [appInsights]
}

// ── Key Vault (needs App Service principal ID) ────────────────────────────────
module keyVault 'modules/keyVault.bicep' = {
  name: 'keyVault-${suffix}'
  params: {
    location: location
    env: env
    suffix: suffix
    appServicePrincipalId: appService.outputs.appServicePrincipalId
    adminObjectIds: adminObjectIds
  }
  dependsOn: [appService]
}

// ── PostgreSQL ────────────────────────────────────────────────────────────────
module postgres 'modules/postgres.bicep' = {
  name: 'postgres-${suffix}'
  params: {
    location: location
    env: env
    suffix: suffix
    adminPassword: postgresAdminPassword
    enableHA: enablePostgresHA
    skuName: env == 'prod' ? 'Standard_D4ds_v5' : 'Standard_D2ds_v5'
    storageSizeGB: env == 'prod' ? 256 : 32
    allowedIPs: appServiceOutboundIPs
  }
}

// ── Redis ─────────────────────────────────────────────────────────────────────
module redis 'modules/redis.bicep' = {
  name: 'redis-${suffix}'
  params: {
    location: location
    env: env
    suffix: suffix
  }
}

// ── Storage Account ───────────────────────────────────────────────────────────
module storageAccount 'modules/storageAccount.bicep' = {
  name: 'storage-${suffix}'
  params: {
    location: location
    env: env
    suffix: suffix
  }
}

// ── Static Web App (frontend) ─────────────────────────────────────────────────
module staticWebApp 'modules/staticWebApp.bicep' = {
  name: 'swa-${suffix}'
  params: {
    env: env
    suffix: suffix
    backendUrl: 'https://${appService.outputs.appServiceHostname}'
  }
}

// ── Front Door + WAF ──────────────────────────────────────────────────────────
module frontDoor 'modules/frontDoor.bicep' = {
  name: 'frontDoor-${suffix}'
  params: {
    env: env
    suffix: suffix
    backendHostname: appService.outputs.appServiceHostname
    frontendHostname: staticWebApp.outputs.staticWebAppHostname
    wafMode: env == 'prod' ? 'Prevention' : 'Detection'
  }
  dependsOn: [appService, staticWebApp]
}

// ── API Management ────────────────────────────────────────────────────────────
module apiManagement 'modules/apiManagement.bicep' = {
  name: 'apim-${suffix}'
  params: {
    location: location
    env: env
    suffix: suffix
    backendUrl: 'https://${appService.outputs.appServiceHostname}'
    publisherEmail: apimPublisherEmail
  }
}

// ── Post-deploy: store secrets in Key Vault ───────────────────────────────────
// These use the listKeys() functions to fetch connection strings at deploy time.
// Alternatively, run the infra/scripts/set-keyvault-secrets.sh script after deploy.
resource kvSecretRedis 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  name: 'kv-clouderp-${env}-${suffix}/REDIS-URL'
  properties: {
    value: 'rediss://:${listKeys(resourceId('Microsoft.Cache/redis', 'redis-clouderp-${env}-${suffix}'), '2023-08-01').primaryKey}@redis-clouderp-${env}-${suffix}.redis.cache.windows.net:6380'
  }
  dependsOn: [keyVault, redis]
}

resource kvSecretStorage 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  name: 'kv-clouderp-${env}-${suffix}/AZURE-STORAGE-CONNECTION-STRING'
  properties: {
    value: 'DefaultEndpointsProtocol=https;AccountName=sterp${env}${take(replace(suffix, \'-\', \'\'), 8)};AccountKey=${listKeys(resourceId('Microsoft.Storage/storageAccounts', 'sterp${env}${take(replace(suffix, \'-\', \'\'), 8)}'), '2023-01-01').keys[0].value};EndpointSuffix=core.windows.net'
  }
  dependsOn: [keyVault, storageAccount]
}

// ── Outputs ───────────────────────────────────────────────────────────────────
output appServiceName string          = appService.outputs.appServiceName
output appServiceUrl string           = 'https://${appService.outputs.appServiceHostname}'
output frontDoorUrl string            = 'https://${frontDoor.outputs.frontDoorHostname}'
output staticWebAppUrl string         = 'https://${staticWebApp.outputs.staticWebAppHostname}'
output keyVaultName string            = keyVault.outputs.keyVaultName
output acrLoginServer string          = appService.outputs.acrLoginServer
output postgresServerFqdn string      = postgres.outputs.serverFqdn
output appInsightsConnectionString string = appInsights.outputs.connectionString
