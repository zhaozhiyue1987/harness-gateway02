import { DEFAULT_MODEL_ID, CREDENTIAL_REF_PREFIX, type DiscoveryRoute } from './contracts.ts'

function shortHash(value: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
function safePart(value: string, fallback: string): string {
  const safe = value.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return safe || fallback
}
export function providerId(connectionId: string, gatewayInstanceId: string, routeId: string): string {
  return `higress-credential-${safePart(routeId, 'route')}-${shortHash(`${connectionId}\0${gatewayInstanceId}\0${routeId}`)}`
}

export function credentialRef(connectionId: string): string {
  const safe = connectionId.trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase()
  if (!safe) throw new Error('connection id cannot produce a credential reference')
  return `${CREDENTIAL_REF_PREFIX}${safe}_KEY`
}

export function providerApi(protocol: string): string {
  return protocol.trim().toUpperCase() === 'OPENAI_CHAT_COMPLETIONS'
    ? 'openai-completions'
    : protocol.trim()
}

export function modelId(route: DiscoveryRoute): string {
  const model = route.models.find(item => item.isDefault)?.id
    ?? route.models.find(item => item.id.trim().length > 0)?.id
  return model?.trim() || DEFAULT_MODEL_ID
}

export function providerProfile(
  route: DiscoveryRoute,
  connectionId: string,
  connectionDisplayName: string,
  gatewayInstanceId: string,
): Record<string, unknown> {
  if (!route.eligibility.connectable) {
    throw new Error(route.eligibility.reasonMessage || `route ${route.route.routeId} is not connectable`)
  }
  const model = modelId(route)
  return {
    displayName: `${connectionDisplayName} · ${route.route.name || route.route.routeId}`,
    api: providerApi(route.endpoint.protocol),
    baseURL: route.endpoint.baseUrl.replace(/\/+$/, ''),
    models: [{ id: model, name: model }],
    apiKeyEnv: credentialRef(connectionId),
  }
}
