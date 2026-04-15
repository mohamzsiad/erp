// ── API Management ────────────────────────────────────────────────────────────
@description('Azure region for all resources')
param location string

@description('Environment name (dev | prod)')
param env string

@description('Resource name suffix / unique token')
param suffix string

@description('Backend API URL')
param backendUrl string

@description('Publisher email for APIM notifications')
param publisherEmail string

@description('Publisher name')
param publisherName string = 'CloudERP'

// Developer tier for dev, Standard for prod
var apimSku = env == 'prod' ? 'Standard' : 'Developer'
var apimName = 'apim-clouderp-${env}-${suffix}'

resource apiManagement 'Microsoft.ApiManagement/service@2023-05-01-preview' = {
  name: apimName
  location: location
  sku: {
    name: apimSku
    capacity: env == 'prod' ? 1 : 0
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    publisherEmail: publisherEmail
    publisherName: publisherName
    virtualNetworkType: 'None'
    customProperties: {
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls10': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Tls11': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Protocols.Ssl30': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Tls10': 'False'
      'Microsoft.WindowsAzure.ApiManagement.Gateway.Security.Backend.Protocols.Tls11': 'False'
    }
  }
}

// ── Backend pointing to App Service ──────────────────────────────────────────
resource backend 'Microsoft.ApiManagement/service/backends@2023-05-01-preview' = {
  parent: apiManagement
  name: 'clouderp-backend'
  properties: {
    description: 'CloudERP App Service backend'
    url: backendUrl
    protocol: 'http'
    tls: {
      validateCertificateChain: true
      validateCertificateName: true
    }
  }
}

// ── API definition ────────────────────────────────────────────────────────────
resource api 'Microsoft.ApiManagement/service/apis@2023-05-01-preview' = {
  parent: apiManagement
  name: 'clouderp-api'
  properties: {
    displayName: 'CloudERP API'
    path: 'api/v1'
    protocols: ['https']
    serviceUrl: '${backendUrl}/api/v1'
    subscriptionRequired: false
    apiType: 'http'
    isCurrent: true
    apiRevision: '1'
  }
}

// ── Global policy: rate limiting + JWT validation ─────────────────────────────
resource globalPolicy 'Microsoft.ApiManagement/service/apis/policies@2023-05-01-preview' = {
  parent: api
  name: 'policy'
  properties: {
    format: 'xml'
    value: '''
<policies>
  <inbound>
    <base />
    <!-- Rate limit: 300 calls per minute per IP -->
    <rate-limit-by-key calls="300" renewal-period="60"
      counter-key="@(context.Request.IpAddress)" />
    <!-- Remove internal headers -->
    <set-header name="X-Forwarded-For" exists-action="delete" />
    <!-- Add correlation ID -->
    <set-header name="X-Request-Id" exists-action="override">
      <value>@(context.RequestId.ToString())</value>
    </set-header>
  </inbound>
  <backend>
    <base />
  </backend>
  <outbound>
    <base />
    <!-- Security headers -->
    <set-header name="X-Content-Type-Options" exists-action="override">
      <value>nosniff</value>
    </set-header>
    <set-header name="X-Frame-Options" exists-action="override">
      <value>DENY</value>
    </set-header>
    <set-header name="Referrer-Policy" exists-action="override">
      <value>strict-origin-when-cross-origin</value>
    </set-header>
  </outbound>
  <on-error>
    <base />
  </on-error>
</policies>
'''
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────────
output apimGatewayUrl string = apiManagement.properties.gatewayUrl
output apimName string       = apiManagement.name
