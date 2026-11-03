/** Secret-free contracts shared by the Host connector and configuration UI. */

export const PLUGIN_NAME = 'dsh-higress-credential-routes-plugin'
export const SETTINGS_NAMESPACE = 'higress-credential-routes-host'
export const CREDENTIAL_REF_PREFIX = 'HIGRESS_CREDENTIAL_ROUTES_'
export const DEFAULT_REFRESH_INTERVAL_SECONDS = 60
export const DEFAULT_MODEL_ID = 'higress-default-model'

export type ConnectionStatus =
  | 'DISCONNECTED'
  | 'CONNECTING'
  | 'READY'
  | 'EMPTY'
  | 'SYNC_DEGRADED'
  | 'REAUTH_REQUIRED'
  | 'CONFIG_ERROR'

export interface DiscoveryRoute {
  route: {
    routeId: string
    name: string
    status: string
    configVersion: string
    updatedAt?: number
  }
  endpoint: { protocol: string; baseUrl: string }
  models: Array<{ id: string; displayName?: string; isDefault: boolean; source?: string }>
  authentication: { type: 'BEARER' }
  routing: { sessionAffinityEnabled: boolean; effectivePriority: string }
  eligibility: { connectable: boolean; reasonCode?: string | null; reasonMessage?: string | null }
}

export interface DiscoveryCollection {
  schemaVersion: string
  collectionVersion: string
  gateway: { instanceId: string; displayName?: string }
  routes: DiscoveryRoute[]
}

export interface RouteSummary {
  routeId: string
  name: string
  status: string
  baseUrl: string
  protocol: string
  models: string[]
  connectable: boolean
  reasonCode?: string
  reasonMessage?: string
  sessionAffinityEnabled: boolean
  effectivePriority: string
}

export interface ConnectionSnapshot {
  connectionId: string
  displayName: string
  managementUrl: string
  status: ConnectionStatus
  gatewayInstanceId?: string
  routes: RouteSummary[]
  collectionVersion?: string
  autoRefresh: boolean
  refreshIntervalSeconds: number
  lastRefreshAt?: number
  lastError?: string
}

export interface ConnectorSnapshot {
  connections: ConnectionSnapshot[]
}

export interface ConnectRequest {
  displayName?: string
  managementUrl: string
  credential: string
}

export interface ConnectionRequest {
  connectionId: string
}

export interface RefreshRequest extends ConnectionRequest {
  force?: boolean
}

export interface AutoRefreshRequest extends ConnectionRequest {
  enabled: boolean
  intervalSeconds?: number
}

export interface DisconnectRequest extends ConnectionRequest {
  clearCredential?: boolean
}

export function defaultModel(route: DiscoveryRoute): string {
  const model = route.models.find(item => item.isDefault)?.id
    ?? route.models.find(item => item.id.trim().length > 0)?.id
  return model?.trim() || DEFAULT_MODEL_ID
}

export function routeSummary(route: DiscoveryRoute): RouteSummary {
  return {
    routeId: route.route.routeId,
    name: route.route.name || route.route.routeId,
    status: route.route.status,
    baseUrl: route.endpoint.baseUrl,
    protocol: route.endpoint.protocol,
    models: [defaultModel(route)],
    connectable: route.eligibility.connectable,
    ...(route.eligibility.reasonCode ? { reasonCode: route.eligibility.reasonCode } : {}),
    ...(route.eligibility.reasonMessage ? { reasonMessage: route.eligibility.reasonMessage } : {}),
    sessionAffinityEnabled: route.routing.sessionAffinityEnabled,
    effectivePriority: route.routing.effectivePriority,
  }
}
