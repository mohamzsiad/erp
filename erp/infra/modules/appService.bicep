// ── App Service (Node.js backend) ─────────────────────────────────────────────
@description('Azure region for all resources')
param location string

@description('Environment name (dev | prod)')
param env string

@description('Resource name suffix / unique token')
param suffix string

@description('Azure Container Registry login server')
param acrLoginServer string

@description('Docker image tag to deploy')
param imageTag string = 'latest'

@description('Key Vault URI for Key Vault references')
param keyVaultUri string

@description('Application Insights connection string')
param appInsightsConnectionString string

@description('App Service Plan SKU (P2v3 for prod, P1v3 for dev)')
param skuName string = 'P2v3'

var planName = 'asp-clouderp-${env}-${suffix}'
var appName  = 'app-clouderp-${env}-${suffix}'
var acrName  = replace('acrclouderp${env}${suffix}', '-', '')

// ── ACR (Azure Container Registry) ───────────────────────────────────────────
resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: take(replace('acrclouderp${env}${suffix}', '-', ''), 50)
  location: location
  sku: {
    name: env == 'prod' ? 'Standard' : 'Basic'
  }
  properties: {
    adminUserEnabled: false     // Use managed identity, not admin user
  }
}

// ── App Service Plan ──────────────────────────────────────────────────────────
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: planName
  location: location
  kind: 'linux'
  sku: {
    name: skuName
    tier: 'PremiumV3'
  }
  properties: {
    reserved: true    // Required for Linux
  }
}

// ── Auto-scale: 1–5 instances ─────────────────────────────────────────────────
resource autoScale 'Microsoft.Insights/autoscalesettings@2022-10-01' = {
  name: 'autoscale-${planName}'
  location: location
  properties: {
    enabled: true
    targetResourceUri: appServicePlan.id
    profiles: [
      {
        name: 'Default'
        capacity: {
          minimum: '1'
          maximum: '5'
          default: '2'
        }
        rules: [
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT10M'
              timeAggregation: 'Average'
              operator: 'GreaterThan'
              threshold: 70
            }
            scaleAction: {
              direction: 'Increase'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT5M'
            }
          }
          {
            metricTrigger: {
              metricName: 'CpuPercentage'
              metricResourceUri: appServicePlan.id
              timeGrain: 'PT1M'
              statistic: 'Average'
              timeWindow: 'PT10M'
              timeAggregation: 'Average'
              operator: 'LessThan'
              threshold: 25
            }
            scaleAction: {
              direction: 'Decrease'
              type: 'ChangeCount'
              value: '1'
              cooldown: 'PT10M'
            }
          }
        ]
      }
    ]
  }
}

// ── App Service ───────────────────────────────────────────────────────────────
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: appName
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'    // Managed identity for Key Vault and ACR access
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/clouderp-backend:${imageTag}'
      alwaysOn: true
      http20Enabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      healthCheckPath: '/api/v1/health'
      acrUseManagedIdentityCreds: true
      appSettings: [
        { name: 'DOCKER_REGISTRY_SERVER_URL', value: 'https://${acr.properties.loginServer}' }
        { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'false' }
        { name: 'NODE_ENV', value: 'production' }
        { name: 'PORT', value: '3000' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
        // Key Vault references — resolved at runtime via managed identity
        { name: 'DATABASE_URL',                     value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/DATABASE-URL/)' }
        { name: 'REDIS_URL',                        value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/REDIS-URL/)' }
        { name: 'JWT_SECRET',                       value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/JWT-SECRET/)' }
        { name: 'JWT_REFRESH_SECRET',               value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/JWT-REFRESH-SECRET/)' }
        { name: 'SMTP_PASSWORD',                    value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/SMTP-PASSWORD/)' }
        { name: 'AZURE_STORAGE_CONNECTION_STRING',  value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/AZURE-STORAGE-CONNECTION-STRING/)' }
      ]
    }
  }
}

// ── Staging slot (swap to production for zero-downtime deploys) ───────────────
resource stagingSlot 'Microsoft.Web/sites/slots@2023-01-01' = {
  parent: appService
  name: 'staging'
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/clouderp-backend:${imageTag}'
      alwaysOn: true
      http20Enabled: true
      minTlsVersion: '1.2'
      ftpsState: 'Disabled'
      healthCheckPath: '/api/v1/health'
      acrUseManagedIdentityCreds: true
      appSettings: [
        { name: 'DOCKER_REGISTRY_SERVER_URL', value: 'https://${acr.properties.loginServer}' }
        { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'false' }
        { name: 'NODE_ENV', value: 'production' }
        { name: 'PORT', value: '3000' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
        { name: 'DATABASE_URL',                     value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/DATABASE-URL/)' }
        { name: 'REDIS_URL',                        value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/REDIS-URL/)' }
        { name: 'JWT_SECRET',                       value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/JWT-SECRET/)' }
        { name: 'JWT_REFRESH_SECRET',               value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/JWT-REFRESH-SECRET/)' }
        { name: 'SMTP_PASSWORD',                    value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/SMTP-PASSWORD/)' }
        { name: 'AZURE_STORAGE_CONNECTION_STRING',  value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/AZURE-STORAGE-CONNECTION-STRING/)' }
      ]
    }
  }
}

// ── ACR Pull role for App Service managed identity ────────────────────────────
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, appService.id, acrPullRoleId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource acrPullRoleStaging 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, stagingSlot.id, acrPullRoleId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: stagingSlot.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────────
output appServiceName string          = appService.name
output appServiceHostname string      = appService.properties.defaultHostName
output appServicePrincipalId string   = appService.identity.principalId
output stagingSlotPrincipalId string  = stagingSlot.identity.principalId
output acrLoginServer string          = acr.properties.loginServer
output acrName string                 = acr.name
