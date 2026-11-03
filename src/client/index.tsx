import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import remoteContribution from '../remote.ts'
import { PLUGIN_NAME, SETTINGS_NAMESPACE, type AutoRefreshRequest, type ConnectRequest, type ConnectionSnapshot, type ConnectorSnapshot, type DisconnectRequest, type RefreshRequest } from '../shared/contracts.ts'

const NS = 'settings.higressCredentialRoutes'

const zh = {
  name: 'AsiaInfo AIGW 凭证路由', description: '绑定一个或多个网关凭证，自动发现并切换已授权 AI 路由。',
  add: '新增凭证连接', displayName: '连接名称（可选）', managementUrl: 'Console 管理地址', credential: 'BEARER 网关凭证', connect: '绑定并同步', refresh: '刷新', disconnect: '断开并清理', auto: '自动刷新', seconds: '秒', routeCount: '条路由', empty: '暂无可用路由', loading: '处理中…', error: '操作失败', show: '显示凭证', hide: '隐藏凭证', ready: '已就绪', emptyStatus: '无可调用路由', degraded: '同步异常', reauth: '需要重新绑定', disconnected: '未连接', connecting: '连接中', configError: '配置错误', connectable: '可调用', unavailable: '不可调用', endpoint: '调用地址', model: '模型', protocol: '协议', priority: '路由优先级', lastRefresh: '最近刷新', removeHint: '断开后只清理此连接的 Provider。',
}
const en = {
  name: 'AsiaInfo AIGW credential routes', description: 'Connect one or more gateway credentials and discover authorized AI routes.',
  add: 'Add credential connection', displayName: 'Connection name (optional)', managementUrl: 'Console management URL', credential: 'BEARER gateway credential', connect: 'Connect and sync', refresh: 'Refresh', disconnect: 'Disconnect and clean', auto: 'Auto refresh', seconds: 'seconds', routeCount: 'routes', empty: 'No callable routes', loading: 'Working…', error: 'Operation failed', show: 'Show credential', hide: 'Hide credential', ready: 'Ready', emptyStatus: 'No callable routes', degraded: 'Sync degraded', reauth: 'Re-bind required', disconnected: 'Disconnected', connecting: 'Connecting', configError: 'Configuration error', connectable: 'Callable', unavailable: 'Unavailable', endpoint: 'Endpoint', model: 'Model', protocol: 'Protocol', priority: 'Routing priority', lastRefresh: 'Last refresh', removeHint: 'Disconnecting only cleans Providers owned by this connection.',
}
type Copy = typeof zh

type RawResult<T> = { ok: true; value: T } | { ok: false; error: { message: string } }
type RawRemote = {
  status: () => Promise<RawResult<ConnectorSnapshot>>
  connect: (request: ConnectRequest) => Promise<RawResult<ConnectorSnapshot>>
  refresh: (request: RefreshRequest) => Promise<RawResult<ConnectorSnapshot>>
  setAutoRefresh: (request: AutoRefreshRequest) => Promise<RawResult<ConnectorSnapshot>>
  disconnect: (request: DisconnectRequest) => Promise<RawResult<ConnectorSnapshot>>
}

type Remote = {
  status: () => Promise<ConnectorSnapshot>
  connect: (request: ConnectRequest) => Promise<ConnectorSnapshot>
  refresh: (request: RefreshRequest) => Promise<ConnectorSnapshot>
  setAutoRefresh: (request: AutoRefreshRequest) => Promise<ConnectorSnapshot>
  disconnect: (request: DisconnectRequest) => Promise<ConnectorSnapshot>
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { 'settings.higressCredentialRoutes': keyof Copy }
}

export const inject = ['remote']

async function unwrap<T>(operation: () => Promise<RawResult<T>>): Promise<T> {
  const result = await operation()
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

function statusText(status: ConnectionSnapshot['status'], t: (key: keyof Copy) => string): string {
  switch (status) {
    case 'READY': return t('ready')
    case 'EMPTY': return t('emptyStatus')
    case 'SYNC_DEGRADED': return t('degraded')
    case 'REAUTH_REQUIRED': return t('reauth')
    case 'CONNECTING': return t('connecting')
    case 'CONFIG_ERROR': return t('configError')
    default: return t('disconnected')
  }
}

function formatTime(value?: number): string {
  if (!value) return '—'
  try { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(value) } catch { return '—' }
}

const styles = {
  root: { display: 'grid', gap: 16, padding: 4 },
  header: { display: 'grid', gap: 6 },
  description: { margin: 0, color: 'var(--dsw-alias-label-secondary)', fontSize: 13 },
  card: { display: 'grid', gap: 14, padding: 16, border: '0.5px solid var(--dsw-alias-settings-card-stroke)', borderRadius: 'var(--dsw-radius-xl)', background: 'var(--dsw-alias-settings-card-fill)' },
  form: { display: 'grid', gap: 10 },
  field: { display: 'grid', gap: 5 },
  label: { fontWeight: 600, fontSize: 13 },
  input: { boxSizing: 'border-box' as const, width: '100%', height: 36, padding: '0 10px', border: '0.5px solid var(--dsw-alias-border-l3)', borderRadius: 'var(--dsw-radius-md)', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)', font: 'inherit' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  primary: { height: 36, padding: '0 14px', border: 0, borderRadius: 'var(--dsw-radius-md)', background: 'var(--dsw-alias-button-primary-fill)', color: 'var(--dsw-alias-label-primary-foreground)', cursor: 'pointer', font: 'inherit' },
  secondary: { height: 36, padding: '0 14px', border: '0.5px solid var(--dsw-alias-border-l3)', borderRadius: 'var(--dsw-radius-md)', background: 'transparent', color: 'var(--dsw-alias-label-primary)', cursor: 'pointer', font: 'inherit' },
  danger: { height: 36, padding: '0 14px', border: 0, borderRadius: 'var(--dsw-radius-md)', background: 'transparent', color: 'var(--dsw-alias-state-error-primary)', cursor: 'pointer', font: 'inherit' },
  route: { display: 'grid', gap: 8, padding: 12, border: '0.5px solid var(--dsw-alias-border-l3)', borderRadius: 'var(--dsw-radius-lg)', background: 'var(--dsw-alias-bg-layer-1)' },
  routeHeader: { display: 'flex', justifyContent: 'space-between', gap: 10 },
  muted: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 },
  error: { margin: 0, color: 'var(--dsw-alias-state-error-primary)', fontSize: 13 },
  detail: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, margin: 0, fontSize: 12 },
  value: { margin: 0, overflowWrap: 'anywhere' as const },
} as const

function ConnectionCard({ connection, remote, t, busy, run }: { connection: ConnectionSnapshot; remote: Remote; t: (key: keyof Copy) => string; busy: boolean; run: (operation: () => Promise<ConnectorSnapshot>) => void }): ReactNode {
  const [interval, setIntervalValue] = useState(String(connection.refreshIntervalSeconds))
  const [auto, setAuto] = useState(connection.autoRefresh)
  useEffect(() => { setIntervalValue(String(connection.refreshIntervalSeconds)); setAuto(connection.autoRefresh) }, [connection.refreshIntervalSeconds, connection.autoRefresh])
  return <article style={styles.card} aria-busy={busy}>
    <div style={styles.routeHeader}><div><strong>{connection.displayName}</strong><div style={styles.muted}>{connection.managementUrl}</div></div><strong>{statusText(connection.status, t)}</strong></div>
    <div style={styles.muted}>{connection.routes.length} {t('routeCount')} · {t('lastRefresh')}: {formatTime(connection.lastRefreshAt)}</div>
    {connection.lastError ? <p role="alert" style={styles.error}>{connection.lastError}</p> : null}
    {connection.routes.length === 0 ? <div style={styles.muted}>{t('empty')}</div> : <div style={{ display: 'grid', gap: 8 }}>{connection.routes.map(route => <div key={route.routeId} style={styles.route}>
      <div style={styles.routeHeader}><strong>{route.name}</strong><span style={{ color: route.connectable ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-state-error-primary)', fontSize: 12 }}>{route.connectable ? t('connectable') : t('unavailable')}</span></div>
      <dl style={styles.detail}><div><dt style={styles.muted}>{t('endpoint')}</dt><dd style={styles.value}>{route.baseUrl}</dd></div><div><dt style={styles.muted}>{t('model')}</dt><dd style={styles.value}>{route.models.join(', ')}</dd></div><div><dt style={styles.muted}>{t('protocol')}</dt><dd style={styles.value}>{route.protocol}</dd></div><div><dt style={styles.muted}>{t('priority')}</dt><dd style={styles.value}>{route.effectivePriority}</dd></div></dl>
      {!route.connectable && route.reasonMessage ? <span style={styles.error}>{route.reasonMessage}</span> : null}
    </div>)}</div>}
    <div style={styles.actions}><button type="button" style={styles.secondary} disabled={busy} onClick={() => run(() => remote.refresh({ connectionId: connection.connectionId, force: true }))}>{t('refresh')}</button><button type="button" style={styles.danger} disabled={busy} onClick={() => run(() => remote.disconnect({ connectionId: connection.connectionId, clearCredential: true }))}>{t('disconnect')}</button><label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}><input type="checkbox" checked={auto} disabled={busy} onChange={event => { const enabled = event.currentTarget.checked; setAuto(enabled); run(() => remote.setAutoRefresh({ connectionId: connection.connectionId, enabled, intervalSeconds: Number(interval) })) }} />{t('auto')}</label><input aria-label={t('seconds')} style={{ ...styles.input, width: 90 }} type="number" min={30} max={3600} value={interval} onChange={event => setIntervalValue(event.currentTarget.value)} onBlur={() => run(() => remote.setAutoRefresh({ connectionId: connection.connectionId, enabled: auto, intervalSeconds: Number(interval) }))} /><span style={styles.muted}>{t('removeHint')}</span></div>
  </article>
}

function CredentialRoutesPanel({ remote, t }: { remote: Remote; t: (key: keyof Copy) => string }): ReactNode {
  const [snapshot, setSnapshot] = useState<ConnectorSnapshot>({ connections: [] })
  const [displayName, setDisplayName] = useState('')
  const [managementUrl, setManagementUrl] = useState('')
  const [credential, setCredential] = useState('')
  const [showCredential, setShowCredential] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const run = (operation: () => Promise<ConnectorSnapshot>): void => { setBusy(true); setError(undefined); void operation().then(next => setSnapshot(next)).catch(cause => setError(cause instanceof Error ? cause.message : t('error'))).finally(() => setBusy(false)) }
  useEffect(() => { let live = true; void remote.status().then(next => { if (live) setSnapshot(next) }).catch(() => undefined); return () => { live = false } }, [remote])
  const submit = (event: FormEvent<HTMLFormElement>): void => { event.preventDefault(); run(() => remote.connect({ displayName, managementUrl, credential })); setCredential(''); setShowCredential(false) }
  return <section style={styles.root} aria-busy={busy}>
    <header style={styles.header}><h3 style={{ margin: 0 }}>{t('name')}</h3><p style={styles.description}>{t('description')}</p></header>
    <form onSubmit={submit} style={styles.card}><div style={styles.form}><div style={styles.field}><label style={styles.label}>{t('displayName')}</label><input style={styles.input} value={displayName} onChange={event => setDisplayName(event.currentTarget.value)} autoComplete="off" /></div><div style={styles.field}><label style={styles.label}>{t('managementUrl')}</label><input style={styles.input} type="url" required value={managementUrl} onChange={event => setManagementUrl(event.currentTarget.value)} autoComplete="url" /></div><div style={styles.field}><label style={styles.label}>{t('credential')}</label><div style={{ display: 'flex', gap: 8 }}><input style={{ ...styles.input, flex: 1 }} type={showCredential ? 'text' : 'password'} required value={credential} onChange={event => setCredential(event.currentTarget.value)} autoComplete="new-password" /><button type="button" style={styles.secondary} onClick={() => setShowCredential(value => !value)} aria-label={showCredential ? t('hide') : t('show')}>{showCredential ? t('hide') : t('show')}</button></div></div></div><button type="submit" style={styles.primary} disabled={busy}>{busy ? t('loading') : t('connect')}</button></form>
    {error ? <p role="alert" style={styles.error}>{error}</p> : null}
    {snapshot.connections.map(connection => <ConnectionCard key={connection.connectionId} connection={connection} remote={remote} t={t} busy={busy} run={run} />)}
  </section>
}

function registerUi(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'higress credential routes: dictionaries')
  const raw = (ctx.remote as unknown as { higressCredentialRoutes: RawRemote }).higressCredentialRoutes
  const remote: Remote = { status: () => unwrap(() => raw.status()), connect: request => unwrap(() => raw.connect(request)), refresh: request => unwrap(() => raw.refresh(request)), setAutoRefresh: request => unwrap(() => raw.setAutoRefresh(request)), disconnect: request => unwrap(() => raw.disconnect(request)) }
  const t = ctx.locale.bind(NS) as (key: keyof Copy) => string
  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({ name: 'settings.plugins.tab', id: SETTINGS_NAMESPACE, order: 31, label: () => t('name'), locale: NS, inject: () => ({ remote, t }) }, CredentialRoutesPanel))
}

export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  const unmountRemote = await ctx.remote.$mount(remoteContribution)
  const ui = ctx.inject(['slots', 'locale', 'remote.higressCredentialRoutes'], child => registerUi(child))
  try { await ui } catch (error) { await ui.dispose(); await unmountRemote(); throw error }
  return async () => { await ui.dispose(); await unmountRemote() }
}

export const name = `${PLUGIN_NAME}/client`
