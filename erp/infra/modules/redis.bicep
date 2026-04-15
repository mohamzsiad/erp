// ── Azure Cache for Redis ─────────────────────────────────────────────────────
@description('Azure region for all resources')
param location string

@description('Environment name (dev | prod)')
param env string

@description('Resource name suffix / unique token')
param suffix string

var cacheName = 'redis-clouderp-${env}-${suffix}'

resource redisCache 'Microsoft.Cache/redis@2023-08-01' = {
  name: cacheName
  location: location
  properties: {
    sku: {
      name: 'Standard'    // Standard tier = C1 with replication
      family: 'C'
      capacity: 1         // C1: 1 GB
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
    redisVersion: '6'
    redisConfiguration: {
      'maxmemory-policy': 'allkeys-lru'
      'notify-keyspace-events': ''         // Disable keyspace notifications in prod for perf
    }
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────────
output cacheHostName string = redisCache.properties.hostName
output cacheName string = redisCache.name
// Primary key is fetched via listKeys() in main.bicep and stored in Key Vault
output cacheId string = redisCache.id
