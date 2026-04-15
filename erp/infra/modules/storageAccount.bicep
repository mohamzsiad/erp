// ── Azure Storage Account ─────────────────────────────────────────────────────
@description('Azure region for all resources')
param location string

@description('Environment name (dev | prod)')
param env string

@description('Resource name suffix / unique token')
param suffix string

// Storage account names: 3-24 chars, lowercase alphanumeric only
var storageAccountName = 'sterp${env}${take(replace(suffix, '-', ''), 8)}'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: env == 'prod' ? 'Standard_GRS' : 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    encryption: {
      services: {
        blob: { enabled: true }
        file: { enabled: true }
      }
      keySource: 'Microsoft.Storage'
    }
    networkAcls: {
      defaultAction: 'Allow'    // Restrict to VNet in prod if needed
      bypass: 'AzureServices'
    }
  }
}

// ── Blob containers ───────────────────────────────────────────────────────────
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 30
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: 30
    }
  }
}

resource attachmentsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'erp-attachments'
  properties: {
    publicAccess: 'None'
  }
}

resource reportsContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'erp-reports'
  properties: {
    publicAccess: 'None'
  }
}

resource archiveContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'erp-audit-archive'
  properties: {
    publicAccess: 'None'
  }
}

// ── Lifecycle management: move old reports to cool tier ───────────────────────
resource lifecyclePolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          name: 'archive-old-reports'
          enabled: true
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: ['blockBlob']
              prefixMatch: ['erp-reports/']
            }
            actions: {
              baseBlob: {
                tierToCool: { daysAfterModificationGreaterThan: 90 }
                tierToArchive: { daysAfterModificationGreaterThan: 365 }
              }
            }
          }
        }
      ]
    }
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────────
output storageAccountName string = storageAccount.name
output storageAccountId string   = storageAccount.id
// Connection string is fetched via listKeys() in main.bicep and stored in Key Vault
