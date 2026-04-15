// ── Azure Database for PostgreSQL Flexible Server ─────────────────────────────
@description('Azure region for all resources')
param location string

@description('Environment name (dev | prod)')
param env string

@description('Resource name suffix / unique token')
param suffix string

@description('PostgreSQL admin username')
param adminUsername string = 'erpadmin'

@secure()
@description('PostgreSQL admin password')
param adminPassword string

@description('Enable high availability (zone-redundant)')
param enableHA bool = false

@description('SKU name: Standard_D4ds_v5 = General Purpose 4 vCore')
param skuName string = 'Standard_D4ds_v5'

@description('Storage size in MB')
param storageSizeGB int = 128

@description('App Service outbound IPs to whitelist')
param allowedIPs array = []

var serverName = 'psql-clouderp-${env}-${suffix}'
var dbName     = 'clouderp'

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-06-01-preview' = {
  name: serverName
  location: location
  sku: {
    name: skuName
    tier: 'GeneralPurpose'
  }
  properties: {
    administratorLogin: adminUsername
    administratorLoginPassword: adminPassword
    version: '16'
    storage: {
      storageSizeGB: storageSizeGB
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: env == 'prod' ? 'Enabled' : 'Disabled'
    }
    highAvailability: {
      mode: enableHA ? 'ZoneRedundant' : 'Disabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Enabled'      // Microsoft Entra authentication
      passwordAuth: 'Enabled'
      tenantId: subscription().tenantId
    }
    maintenanceWindow: {
      customWindow: 'Enabled'
      dayOfWeek: 0      // Sunday
      startHour: 2
      startMinute: 0
    }
  }
}

// ── pgbouncer connection pooling ──────────────────────────────────────────────
resource pgbouncerConfig 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-06-01-preview' = {
  parent: postgresServer
  name: 'pgbouncer.enabled'
  properties: {
    value: 'true'
    source: 'user-override'
  }
}

// ── Database ──────────────────────────────────────────────────────────────────
resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-06-01-preview' = {
  parent: postgresServer
  name: dbName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// ── Firewall: allow App Service outbound IPs only ────────────────────────────
resource firewallRules 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-06-01-preview' = [for (ip, i) in allowedIPs: {
  parent: postgresServer
  name: 'AppService-${i}'
  properties: {
    startIpAddress: ip
    endIpAddress: ip
  }
}]

// ── SSL enforcement via server parameters ─────────────────────────────────────
resource sslParam 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-06-01-preview' = {
  parent: postgresServer
  name: 'require_secure_transport'
  properties: {
    value: 'on'
    source: 'user-override'
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────────
output serverFqdn string   = postgresServer.properties.fullyQualifiedDomainName
output serverName string   = postgresServer.name
output databaseName string = database.name
output connectionString string = 'postgresql://${adminUsername}@${serverName}:5432/${dbName}?sslmode=require'
