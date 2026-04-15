// ── Key Vault ──────────────────────────────────────────────────────────────────
@description('Azure region for all resources')
param location string

@description('Environment name (dev | prod)')
param env string

@description('Resource name suffix / unique token')
param suffix string

@description('Principal ID of the App Service managed identity')
param appServicePrincipalId string

@description('Object IDs of admin users who can manage secrets (optional)')
param adminObjectIds array = []

var kvName = 'kv-clouderp-${env}-${suffix}'

resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name: kvName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true          // Use RBAC (not access policies)
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'         // Restrict to VNet in prod via networkAcls
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

// ── RBAC: App Service managed identity → Secrets User ────────────────────────
var secretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'  // Key Vault Secrets User

resource appServiceSecretsRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, appServicePrincipalId, secretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', secretsUserRoleId)
    principalId: appServicePrincipalId
    principalType: 'ServicePrincipal'
  }
}

// ── RBAC: Admin users → Secrets Officer ───────────────────────────────────────
var secretsOfficerRoleId = 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7' // Key Vault Secrets Officer

resource adminSecretsRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for adminId in adminObjectIds: {
  name: guid(keyVault.id, adminId, secretsOfficerRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', secretsOfficerRoleId)
    principalId: adminId
    principalType: 'User'
  }
}]

// ── Secret placeholders (values set out-of-band via deployment script / CI) ──
// These establish the secret names; values are updated by the deploy pipeline.
resource secretDatabaseUrl 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'DATABASE-URL'
  properties: { value: 'REPLACE_AFTER_DEPLOY' }
}

resource secretRedisUrl 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'REDIS-URL'
  properties: { value: 'REPLACE_AFTER_DEPLOY' }
}

resource secretJwtSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'JWT-SECRET'
  properties: { value: 'REPLACE_AFTER_DEPLOY' }
}

resource secretJwtRefreshSecret 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'JWT-REFRESH-SECRET'
  properties: { value: 'REPLACE_AFTER_DEPLOY' }
}

resource secretSmtpPassword 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'SMTP-PASSWORD'
  properties: { value: 'REPLACE_AFTER_DEPLOY' }
}

resource secretStorageConn 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name: 'AZURE-STORAGE-CONNECTION-STRING'
  properties: { value: 'REPLACE_AFTER_DEPLOY' }
}

// ── Outputs ────────────────────────────────────────────────────────────────────
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
