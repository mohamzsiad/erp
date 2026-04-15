// ── Azure Static Web Apps (React frontend) ────────────────────────────────────
@description('Environment name (dev | prod)')
param env string

@description('Resource name suffix / unique token')
param suffix string

@description('Backend API URL for CORS and routing')
param backendUrl string

@description('Custom domain (optional, set after provisioning)')
param customDomain string = ''

var swaName = 'swa-clouderp-${env}-${suffix}'

resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: swaName
  // Static Web Apps are a global resource — location must be one of the supported regions
  location: 'eastus2'
  sku: {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    buildProperties: {
      appLocation: 'packages/frontend'
      outputLocation: 'dist'
      appBuildCommand: 'npm run build'
    }
    stagingEnvironmentPolicy: 'Enabled'    // Allow PR preview environments
    allowConfigFileUpdates: true
    enterpriseGradeCdnStatus: 'Disabled'
  }
}

// ── Link backend API (enables built-in auth proxy and routing) ────────────────
resource backendLink 'Microsoft.Web/staticSites/linkedBackends@2023-01-01' = if (!empty(backendUrl)) {
  parent: staticWebApp
  name: 'backend'
  properties: {
    backendResourceId: ''    // Set after App Service is known; use az cli in pipeline
    region: 'eastus2'
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────────
output staticWebAppName string     = staticWebApp.name
output staticWebAppHostname string = staticWebApp.properties.defaultHostname
output deploymentToken string      = staticWebApp.listSecrets().properties.apiKey
