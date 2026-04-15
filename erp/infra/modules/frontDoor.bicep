// ── Azure Front Door Standard + WAF ──────────────────────────────────────────
@description('Environment name (dev | prod)')
param env string

@description('Resource name suffix / unique token')
param suffix string

@description('App Service backend hostname (e.g. app-clouderp-prod-xxx.azurewebsites.net)')
param backendHostname string

@description('Static Web App hostname (frontend)')
param frontendHostname string

@description('WAF mode: Detection for dev, Prevention for prod')
param wafMode string = env == 'prod' ? 'Prevention' : 'Detection'

var profileName    = 'afd-clouderp-${env}-${suffix}'
var wafPolicyName  = 'wafclouderp${env}${take(replace(suffix, '-', ''), 8)}'

// ── WAF Policy ────────────────────────────────────────────────────────────────
resource wafPolicy 'Microsoft.Network/FrontDoorWebApplicationFirewallPolicies@2022-05-01' = {
  name: wafPolicyName
  location: 'global'
  sku: {
    name: 'Standard_AzureFrontDoor'
  }
  properties: {
    policySettings: {
      enabledState: 'Enabled'
      mode: wafMode
      requestBodyCheck: 'Enabled'
    }
    managedRules: {
      managedRuleSets: [
        {
          ruleSetType: 'Microsoft_DefaultRuleSet'
          ruleSetVersion: '2.1'
          ruleSetAction: 'Block'
        }
        {
          ruleSetType: 'Microsoft_BotManagerRuleSet'
          ruleSetVersion: '1.0'
          ruleSetAction: 'Block'
        }
      ]
    }
    customRules: {
      rules: [
        {
          name: 'RateLimitRule'
          priority: 10
          ruleType: 'RateLimitRule'
          rateLimitThreshold: 300
          rateLimitDurationInMinutes: 1
          action: 'Block'
          matchConditions: [
            {
              matchVariable: 'RemoteAddr'
              operator: 'IPMatch'
              negateCondition: true
              matchValue: ['0.0.0.0/0']    // Apply to all IPs
            }
          ]
        }
      ]
    }
  }
}

// ── Front Door Profile ────────────────────────────────────────────────────────
resource frontDoorProfile 'Microsoft.Cdn/profiles@2023-05-01' = {
  name: profileName
  location: 'global'
  sku: {
    name: 'Standard_AzureFrontDoor'
  }
}

// ── Endpoint ──────────────────────────────────────────────────────────────────
resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2023-05-01' = {
  parent: frontDoorProfile
  name: 'clouderp-${env}'
  location: 'global'
  properties: {
    enabledState: 'Enabled'
  }
}

// ── Origin group: API backend ─────────────────────────────────────────────────
resource apiOriginGroup 'Microsoft.Cdn/profiles/originGroups@2023-05-01' = {
  parent: frontDoorProfile
  name: 'api-origin-group'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/api/v1/health'
      probeRequestType: 'HEAD'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
    sessionAffinityState: 'Disabled'
  }
}

resource apiOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2023-05-01' = {
  parent: apiOriginGroup
  name: 'app-service-origin'
  properties: {
    hostName: backendHostname
    httpPort: 80
    httpsPort: 443
    originHostHeader: backendHostname
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
    enforceCertificateNameCheck: true
  }
}

// ── Origin group: Frontend ────────────────────────────────────────────────────
resource frontendOriginGroup 'Microsoft.Cdn/profiles/originGroups@2023-05-01' = {
  parent: frontDoorProfile
  name: 'frontend-origin-group'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/'
      probeRequestType: 'HEAD'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 30
    }
  }
}

resource frontendOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2023-05-01' = {
  parent: frontendOriginGroup
  name: 'static-web-app-origin'
  properties: {
    hostName: frontendHostname
    httpPort: 80
    httpsPort: 443
    originHostHeader: frontendHostname
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────
resource apiRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: endpoint
  name: 'api-route'
  dependsOn: [apiOrigin]
  properties: {
    originGroup: {
      id: apiOriginGroup.id
    }
    supportedProtocols: ['Https']
    patternsToMatch: ['/api/*']
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
  }
}

resource wsRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: endpoint
  name: 'ws-route'
  dependsOn: [apiOrigin]
  properties: {
    originGroup: {
      id: apiOriginGroup.id
    }
    supportedProtocols: ['Https']
    patternsToMatch: ['/api/v1/notifications/ws']
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Disabled'   // WebSocket — no redirect
  }
}

resource frontendRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: endpoint
  name: 'frontend-route'
  dependsOn: [frontendOrigin]
  properties: {
    originGroup: {
      id: frontendOriginGroup.id
    }
    supportedProtocols: ['Https']
    patternsToMatch: ['/*']
    forwardingProtocol: 'HttpsOnly'
    linkToDefaultDomain: 'Enabled'
    httpsRedirect: 'Enabled'
  }
}

// ── Security Policy (WAF) ─────────────────────────────────────────────────────
resource securityPolicy 'Microsoft.Cdn/profiles/securityPolicies@2023-05-01' = {
  parent: frontDoorProfile
  name: 'waf-policy'
  properties: {
    parameters: {
      type: 'WebApplicationFirewall'
      wafPolicy: {
        id: wafPolicy.id
      }
      associations: [
        {
          domains: [
            { id: endpoint.id }
          ]
          patternsToMatch: ['/*']
        }
      ]
    }
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────────
output frontDoorHostname string = endpoint.properties.hostName
output frontDoorProfileName string = frontDoorProfile.name
output endpointName string = endpoint.name
