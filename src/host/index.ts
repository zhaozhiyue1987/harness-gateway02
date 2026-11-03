import { randomUUID } from 'node:crypto'
import type { Context, Volatile } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { credentialRef as harnessCredentialRef } from '@deepseek-ai/dsh-credentials'
import type { SettingsNamespace, SettingsPathOp } from '@deepseek-ai/dsh-settings'
import {
  DEFAULT_REFRESH_INTERVAL_SECONDS,
  PLUGIN_NAME,
  SETTINGS_NAMESPACE,
  type AutoRefreshRequest,
  type ConnectRequest,
  type ConnectionSnapshot,
  type ConnectorSnapshot,
  type ConnectionRequest,
  type DiscoveryCollection,
  type DiscoveryRoute,
  type DisconnectRequest,
  type RefreshRequest,
} from '../shared/contracts.ts'
import { credentialRef, providerId, providerProfile } from '../shared/route-mapper.ts'
import { DiscoveryClient, GatewayHttpError, type DiscoveryToken } from './gateway-client.ts'

export interface Config {
  timeoutMs: number
  connections: Volatile<unknown>
}

export const Config = Schema.object({
  timeoutMs: Schema.number().default(10000),
  connections: Schema.any().default([]).volatile(),
}) as unknown as Schema<Config>

interface PersistedConnection {
  connectionId: string
  displayName: string
  managementUrl: string
  credentialRef: string
  gatewayInstanceId?: string
  etag?: string
  collectionVersion?: string
  managedProviderIds: string[]
  autoRefresh: boolean
  refreshIntervalSeconds: number
  lastRefreshAt?: number
}

interface RuntimeConnection {
  client: DiscoveryClient
  token?: DiscoveryToken
  routes: DiscoveryRoute[]
  status: ConnectionSnapshot['status']
  lastError?: string
}

function asPersisted(value: unknown): PersistedConnection[] {
  if (!Array.isArray(value)) return []
  return value.flatMap(item => {
    if (item === null || typeof item !== 'object') return []
    const source = item as Partial<PersistedConnection>
    if (typeof source.connectionId !== 'string' || typeof source.managementUrl !== 'string' || typeof source.credentialRef !== 'string') return []
    return [{
      connectionId: source.connectionId,
      displayName: typeof source.displayName === 'string' && source.displayName.trim() ? source.displayName : 'AsiaInfo AIGW connection',
      managementUrl: source.managementUrl,
      credentialRef: source.credentialRef,
      gatewayInstanceId: source.gatewayInstanceId,
      etag: source.etag,
      collectionVersion: source.collectionVersion,
      managedProviderIds: Array.isArray(source.managedProviderIds) ? source.managedProviderIds.filter((id): id is string => typeof id === 'string') : [],
      autoRefresh: source.autoRefresh === true,
      refreshIntervalSeconds: Math.max(30, Math.min(3600, Math.floor(Number(source.refreshIntervalSeconds ?? DEFAULT_REFRESH_INTERVAL_SECONDS)))),
      lastRefreshAt: typeof source.lastRefreshAt === 'number' ? source.lastRefreshAt : undefined,
    }]
  })
}

function publicError(error: unknown): string {
  if (error instanceof GatewayHttpError) return error.message
  if (error instanceof Error) return error.message
  return 'gateway operation failed'
}

function normalizeName(value: string | undefined): string {
  const name = value?.trim()
  return name || 'AsiaInfo AIGW connection'
}

/** Host-owned multi-credential connector. Secrets and discovery tokens never cross Remote. */
export class HigressCredentialRoutesService extends TypertRemoteService {
  static inject = ['settings', 'credentials']
  static Config = Config

  private readonly config: Config
  private readonly credentials: {
    set: (ref: ReturnType<typeof harnessCredentialRef>, value: string) => Promise<void>
    resolve: (ref: ReturnType<typeof harnessCredentialRef>) => Promise<{ value: string } | undefined>
    unset: (ref: ReturnType<typeof harnessCredentialRef>) => Promise<void>
  }
  private readonly settingsEntry: SettingsNamespace = SETTINGS_NAMESPACE as SettingsNamespace
  private readonly runtime = new Map<string, RuntimeConnection>()
  private operation: Promise<unknown> = Promise.resolve()
  private timer?: ReturnType<typeof setInterval>

  constructor(ctx: Context, config: Config) {
    super(ctx, 'higressCredentialRoutes')
    this.config = config
    this.credentials = ctx.credentials
    ctx.effect(() => ctx.settings.configure({ auto: false }, ctx.fiber), 'higress credential routes: settings presentation')
    void this.restore()
    ctx.effect(() => () => this.stopTimer(), 'higress credential routes: refresh timer')
  }

  @Remote('status')
  status(): ConnectorSnapshot {
    return { connections: this.persisted().map(connection => this.snapshot(connection)) }
  }

  @Remote('connect')
  async connect(request: ConnectRequest): Promise<ConnectorSnapshot> {
    return this.serial(async () => {
      const managementUrl = new DiscoveryClient(request.managementUrl, { timeoutMs: this.config.timeoutMs }).baseUrl
      const credential = request.credential.trim()
      if (!credential) throw new Error('credential is required')
      const connectionId = `c-${randomUUID()}`
      const client = new DiscoveryClient(managementUrl, { timeoutMs: this.config.timeoutMs })
      const token = await client.exchange(credential)
      const persisted: PersistedConnection = {
        connectionId,
        displayName: normalizeName(request.displayName),
        managementUrl,
        credentialRef: credentialRef(connectionId),
        managedProviderIds: [],
        autoRefresh: false,
        refreshIntervalSeconds: DEFAULT_REFRESH_INTERVAL_SECONDS,
      }
      await this.credentials.set(harnessCredentialRef(persisted.credentialRef), credential)
      await this.persist([...this.persisted(), persisted])
      this.runtime.set(connectionId, { client, token, routes: [], status: 'CONNECTING' })
      try {
        await this.refreshLocked(persisted, true)
      } catch (error) {
        this.runtime.delete(connectionId)
        await this.credentials.unset(harnessCredentialRef(persisted.credentialRef)).catch(() => undefined)
        await this.persist(this.persisted().filter(item => item.connectionId !== connectionId))
        throw error
      }
      this.scheduleTimer()
      return this.status()
    })
  }

  @Remote('refresh')
  async refresh(request: RefreshRequest): Promise<ConnectorSnapshot> {
    return this.serial(async () => {
      const connection = this.requirePersisted(request.connectionId)
      await this.refreshLocked(connection, request.force === true)
      return this.status()
    })
  }

  @Remote('setAutoRefresh')
  async setAutoRefresh(request: AutoRefreshRequest): Promise<ConnectorSnapshot> {
    return this.serial(async () => {
      const interval = Math.max(30, Math.min(3600, Math.floor(request.intervalSeconds ?? DEFAULT_REFRESH_INTERVAL_SECONDS)))
      const connections = this.persisted().map(connection => connection.connectionId === request.connectionId
        ? { ...connection, autoRefresh: request.enabled, refreshIntervalSeconds: interval }
        : connection)
      await this.persist(connections)
      this.scheduleTimer()
      return this.status()
    })
  }

  @Remote('disconnect')
  async disconnect(request: DisconnectRequest): Promise<ConnectorSnapshot> {
    return this.serial(async () => {
      const connection = this.requirePersisted(request.connectionId)
      await this.removeOwnedProviders(connection)
      if (request.clearCredential !== false) await this.credentials.unset(harnessCredentialRef(connection.credentialRef))
      this.runtime.delete(connection.connectionId)
      await this.persist(this.persisted().filter(item => item.connectionId !== connection.connectionId))
      this.scheduleTimer()
      return this.status()
    })
  }

  private async restore(): Promise<void> {
    for (const connection of this.persisted()) {
      try {
        const stored = await this.credentials.resolve(harnessCredentialRef(connection.credentialRef))
        if (!stored) {
          this.runtime.set(connection.connectionId, { client: new DiscoveryClient(connection.managementUrl, { timeoutMs: this.config.timeoutMs }), routes: [], status: 'REAUTH_REQUIRED', lastError: 'credential is unavailable' })
          continue
        }
        const client = new DiscoveryClient(connection.managementUrl, { timeoutMs: this.config.timeoutMs })
        const token = await client.exchange(stored.value)
        this.runtime.set(connection.connectionId, { client, token, routes: [], status: 'CONNECTING' })
        await this.refreshLocked(connection, false)
      } catch (error) {
        const current = this.runtime.get(connection.connectionId)
        this.runtime.set(connection.connectionId, { client: current?.client ?? new DiscoveryClient(connection.managementUrl, { timeoutMs: this.config.timeoutMs }), token: current?.token, routes: current?.routes ?? [], status: error instanceof GatewayHttpError && error.code === 'AUTH_REQUIRED' ? 'REAUTH_REQUIRED' : 'SYNC_DEGRADED', lastError: publicError(error) })
      }
    }
    this.scheduleTimer()
  }

  private async refreshLocked(connection: PersistedConnection, force: boolean): Promise<void> {
    let runtime = this.runtime.get(connection.connectionId)
    if (!runtime) {
      runtime = { client: new DiscoveryClient(connection.managementUrl, { timeoutMs: this.config.timeoutMs }), routes: [], status: 'CONNECTING' }
      this.runtime.set(connection.connectionId, runtime)
    }
    const stored = await this.credentials.resolve(harnessCredentialRef(connection.credentialRef))
    if (!stored) {
      await this.markReauth(connection, runtime, 'credential is unavailable')
      throw new GatewayHttpError(401, 'AUTH_REQUIRED', 'authentication failed')
    }
    try {
      if (!runtime.token || runtime.token.expiresAt - Date.now() < 60_000) runtime.token = await runtime.client.exchange(stored.value)
      const result = await runtime.client.routes(runtime.token.accessToken, force ? undefined : connection.etag)
      if (!result.notModified && result.value) {
        const collection = result.value
        await this.syncProviders(connection, collection)
        runtime.routes = collection.routes
        connection.gatewayInstanceId = collection.gateway.instanceId
        connection.collectionVersion = collection.collectionVersion
        connection.etag = result.etag
      }
      connection.lastRefreshAt = Date.now()
      runtime.status = runtime.routes.some(route => route.eligibility.connectable) ? 'READY' : 'EMPTY'
      runtime.lastError = undefined
      await this.persist(this.persisted().map(item => item.connectionId === connection.connectionId ? connection : item))
    } catch (error) {
      if (error instanceof GatewayHttpError && error.code === 'AUTH_REQUIRED') {
        try {
          runtime.token = await runtime.client.exchange(stored.value)
          const retry = await runtime.client.routes(runtime.token.accessToken, undefined)
          if (retry.value) {
            await this.syncProviders(connection, retry.value)
            runtime.routes = retry.value.routes
            connection.gatewayInstanceId = retry.value.gateway.instanceId
            connection.collectionVersion = retry.value.collectionVersion
            connection.etag = retry.etag
            connection.lastRefreshAt = Date.now()
            runtime.status = runtime.routes.some(route => route.eligibility.connectable) ? 'READY' : 'EMPTY'
            runtime.lastError = undefined
            await this.persist(this.persisted().map(item => item.connectionId === connection.connectionId ? connection : item))
            return
          }
        } catch (retryError) {
          await this.markReauth(connection, runtime, publicError(retryError))
          throw retryError
        }
        await this.markReauth(connection, runtime, 'authentication failed')
      } else {
        runtime.status = 'SYNC_DEGRADED'
        runtime.lastError = publicError(error)
      }
      throw error
    }
  }

  private async markReauth(connection: PersistedConnection, runtime: RuntimeConnection, message: string): Promise<void> {
    runtime.status = 'REAUTH_REQUIRED'
    runtime.lastError = message
    await this.removeOwnedProviders(connection)
    connection.managedProviderIds = []
    await this.persist(this.persisted().map(item => item.connectionId === connection.connectionId ? connection : item))
  }

  private async syncProviders(connection: PersistedConnection, collection: DiscoveryCollection): Promise<void> {
    const gatewayInstanceId = collection.gateway.instanceId
    const desired = new Map<string, Record<string, unknown>>()
    for (const route of collection.routes.filter(item => item.eligibility.connectable)) {
      desired.set(providerId(connection.connectionId, gatewayInstanceId, route.route.routeId), providerProfile(route, connection.connectionId, connection.displayName, gatewayInstanceId))
    }
    const previous = new Set(connection.managedProviderIds)
    const ops: SettingsPathOp[] = []
    for (const [id, profile] of desired) ops.push({ op: 'set', path: ['providers', id], value: profile })
    for (const id of previous) if (!desired.has(id)) ops.push({ op: 'unset', path: ['providers', id] })
    if (ops.length > 0) await this.ctx.settings.mutate('llm-pi-ai', ops)
    connection.managedProviderIds = [...desired.keys()]
  }

  private async removeOwnedProviders(connection: PersistedConnection): Promise<void> {
    if (connection.managedProviderIds.length === 0) return
    try {
      await this.ctx.settings.mutate('llm-pi-ai', connection.managedProviderIds.map(id => ({ op: 'unset', path: ['providers', id] })))
    } catch {
      // Provider settings can be unavailable during uninstall; local state is still cleared.
    }
  }

  private snapshot(connection: PersistedConnection): ConnectionSnapshot {
    const runtime = this.runtime.get(connection.connectionId)
    return {
      connectionId: connection.connectionId,
      displayName: connection.displayName,
      managementUrl: connection.managementUrl,
      status: runtime?.status ?? 'DISCONNECTED',
      ...(connection.gatewayInstanceId ? { gatewayInstanceId: connection.gatewayInstanceId } : {}),
      routes: (runtime?.routes ?? []).map(route => ({
        routeId: route.route.routeId,
        name: route.route.name || route.route.routeId,
        status: route.route.status,
        baseUrl: route.endpoint.baseUrl,
        protocol: route.endpoint.protocol,
        models: [route.models.find(item => item.isDefault)?.id ?? route.models[0]?.id ?? 'higress-default-model'],
        connectable: route.eligibility.connectable,
        ...(route.eligibility.reasonCode ? { reasonCode: route.eligibility.reasonCode } : {}),
        ...(route.eligibility.reasonMessage ? { reasonMessage: route.eligibility.reasonMessage } : {}),
        sessionAffinityEnabled: route.routing.sessionAffinityEnabled,
        effectivePriority: route.routing.effectivePriority,
      })),
      ...(connection.collectionVersion ? { collectionVersion: connection.collectionVersion } : {}),
      autoRefresh: connection.autoRefresh,
      refreshIntervalSeconds: connection.refreshIntervalSeconds,
      ...(connection.lastRefreshAt ? { lastRefreshAt: connection.lastRefreshAt } : {}),
      ...(runtime?.lastError ? { lastError: runtime.lastError } : {}),
    }
  }

  private persisted(): PersistedConnection[] {
    return asPersisted(this.config.connections.get())
  }

  private async persist(connections: PersistedConnection[]): Promise<void> {
    await this.ctx.settings.replace(this.settingsEntry, { connections })
  }

  private requirePersisted(connectionId: string): PersistedConnection {
    const connection = this.persisted().find(item => item.connectionId === connectionId)
    if (!connection) throw new Error('connection was not found')
    return connection
  }

  private scheduleTimer(): void {
    this.stopTimer()
    if (!this.persisted().some(connection => connection.autoRefresh)) return
    this.timer = setInterval(() => {
      void this.serial(async () => {
        const now = Date.now()
        for (const connection of this.persisted()) {
          if (!connection.autoRefresh || (connection.lastRefreshAt && now - connection.lastRefreshAt < connection.refreshIntervalSeconds * 1000)) continue
          try { await this.refreshLocked(connection, false) } catch { /* state records per-connection failure */ }
        }
      })
    }, 1000)
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
  }

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operation.then(operation, operation)
    this.operation = next.then(() => undefined, () => undefined)
    return next
  }
}

export const name = PLUGIN_NAME
export const inject = ['settings', 'credentials']

export function apply(ctx: Context, config: Config): void {
  ctx.plugin(HigressCredentialRoutesService, config)
}

export default HigressCredentialRoutesService
