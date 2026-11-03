/* Generated-compatible Typert metadata for dsh-higress-credential-routes-plugin. */
import { z } from 'zod'
import { createTypertRemoteInfo } from '@deepseek-ai/dsh-typert-protocol/remote-info'

const anyResult = () => z.any()
const json = type => ({ type })
const parameter = (name, schema, typeSymbol) => ({
  name, source: 'json',
  codec: { mode: 'strict', typeSymbol, create: () => schema, jsonSchema: json(typeSymbol === 'string' ? 'string' : 'object') },
  strictCodec: { mode: 'strict', typeSymbol, create: () => schema, jsonSchema: json(typeSymbol === 'string' ? 'string' : 'object') },
})
const result = { mode: 'strict', typeSymbol: 'dsh-higress-credential-routes-plugin/shared#ConnectorSnapshot', create: anyResult, jsonSchema: { type: 'object', additionalProperties: true } }

const methods = {
  'higressCredentialRoutes/status': { service: 'higressCredentialRoutes', invocation: { kind: 'direct' }, parameters: [], result },
  'higressCredentialRoutes/connect': { service: 'higressCredentialRoutes', invocation: { kind: 'direct' }, parameters: [parameter('request', z.object({ displayName: z.string().optional(), managementUrl: z.string(), credential: z.string() }), 'dsh-higress-credential-routes-plugin/shared#ConnectRequest')], result },
  'higressCredentialRoutes/refresh': { service: 'higressCredentialRoutes', invocation: { kind: 'direct' }, parameters: [parameter('request', z.object({ connectionId: z.string(), force: z.boolean().optional() }), 'dsh-higress-credential-routes-plugin/shared#RefreshRequest')], result },
  'higressCredentialRoutes/setAutoRefresh': { service: 'higressCredentialRoutes', invocation: { kind: 'direct' }, parameters: [parameter('request', z.object({ connectionId: z.string(), enabled: z.boolean(), intervalSeconds: z.number().optional() }), 'dsh-higress-credential-routes-plugin/shared#AutoRefreshRequest')], result },
  'higressCredentialRoutes/disconnect': { service: 'higressCredentialRoutes', invocation: { kind: 'direct' }, parameters: [parameter('request', z.object({ connectionId: z.string(), clearCredential: z.boolean().optional() }), 'dsh-higress-credential-routes-plugin/shared#DisconnectRequest')], result },
}

const $remote = createTypertRemoteInfo({ package: 'dsh-higress-credential-routes-plugin', methods }, z)
export const TYPERT = { package: 'dsh-higress-credential-routes-plugin', face: 'host', schemas: [], get invocations() { return $remote.descriptors }, model: { services: [], events: [], objects: [] } }
