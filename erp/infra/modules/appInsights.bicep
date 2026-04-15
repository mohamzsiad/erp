// ── Application Insights + Log Analytics Workspace ───────────────────────────
@description('Azure region for all resources')
param location string

@description('Environment name (dev | prod)')
param env string

@description('Resource name suffix / unique token')
param suffix string

var workspaceName    = 'log-clouderp-${env}-${suffix}'
var appInsightsName  = 'appi-clouderp-${env}-${suffix}'

// ── Log Analytics Workspace ───────────────────────────────────────────────────
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: workspaceName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: env == 'prod' ? 90 : 30
    features: {
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    workspaceCapping: {
      dailyQuotaGb: env == 'prod' ? 5 : 1
    }
  }
}

// ── Application Insights ──────────────────────────────────────────────────────
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
    RetentionInDays: env == 'prod' ? 90 : 30
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
    DisableIpMasking: false
  }
}

// ── Alert: High error rate (>5%) ──────────────────────────────────────────────
resource errorRateAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-error-rate-${env}'
  location: 'global'
  properties: {
    description: 'Alert when server error rate exceeds 5%'
    severity: 2
    enabled: true
    scopes: [appInsights.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighErrorRate'
          criterionType: 'StaticThresholdCriterion'
          metricName: 'requests/failed'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Count'
        }
      ]
    }
    autoMitigate: true
  }
}

// ── Alert: Slow response time (>2s) ──────────────────────────────────────────
resource responseTimeAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-response-time-${env}'
  location: 'global'
  properties: {
    description: 'Alert when P95 response time exceeds 2 seconds'
    severity: 3
    enabled: true
    scopes: [appInsights.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'SlowResponse'
          criterionType: 'StaticThresholdCriterion'
          metricName: 'requests/duration'
          operator: 'GreaterThan'
          threshold: 2000
          timeAggregation: 'Average'
        }
      ]
    }
    autoMitigate: true
  }
}

// ── Outputs ───────────────────────────────────────────────────────────────────
output appInsightsName string             = appInsights.name
output appInsightsId string               = appInsights.id
output connectionString string            = appInsights.properties.ConnectionString
output instrumentationKey string          = appInsights.properties.InstrumentationKey
output logAnalyticsWorkspaceId string     = logAnalytics.id
