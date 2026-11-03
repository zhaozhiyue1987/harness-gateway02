/* Generated-compatible Typert Remote metadata for dsh-higress-credential-routes-plugin. */
import { z } from 'zod'
import { createTypertRemoteInfo } from '@deepseek-ai/dsh-typert-protocol/remote-info'

const anyResult = { mode: 'strict', typeSymbol: 'dsh-higress-credential-routes-plugin/shared#ConnectorSnapshot', create: () => z.any(), jsonSchema: { type: 'object', additionalProperties: true } }
const parameter = (name, schema, typeSymbol) => ({ name, source: 'json', codec: { mode: 'strict', typeSymbol, create: () => schema, jsonSchema: { type: 'object', additionalProperties: true } }, strictCodec: { mode: 'strict', typeSymbol, create: () => schema, jsonSchema: { type: 'object', additionalProperties: false } } })
const methods = {
  'higressCredentialRoutes/status': { service: 'higressCredentialRoutes', invocation: { kind: 'direct' }, parameters: [], result: anyResult },
  'higressCredentialRoutes/connect': { service: 'higressCredentialRoutes', invocation: { kind: 'direct' }, parameters: [parameter('request', z.object({ displayName: z.string().optional(), managementUrl: z.string(), credential: z.string() }), 'dsh-higress-credential-routes-plugin/shared#ConnectRequest')], result: anyResult },
  'higressCredentialRoutes/refresh': { service: 'higressCredentialRoutes', invocation: { kind: 'direct' }, parameters: [parameter('request', z.object({ connectionId: z.string(), force: z.boolean().optional() }), 'dsh-higress-credential-routes-plugin/shared#RefreshRequest')], result: anyResult },
  'higressCredentialRoutes/setAutoRefresh': { service: 'higressCredentialRoutes', invocation: { kind: 'direct' }, parameters: [parameter('request', z.object({ connectionId: z.string(), enabled: z.boolean(), intervalSeconds: z.number().optional() }), 'dsh-higress-credential-routes-plugin/shared#AutoRefreshRequest')], result: anyResult },
  'higressCredentialRoutes/disconnect': { service: 'higressCredentialRoutes', invocation: { kind: 'direct' }, parameters: [parameter('request', z.object({ connectionId: z.string(), clearCredential: z.boolean().optional() }), 'dsh-higress-credential-routes-plugin/shared#DisconnectRequest')], result: anyResult },
}

const remoteInfo = createTypertRemoteInfo({ package: 'dsh-higress-credential-routes-plugin', methods }, z)
export const TYPERT_REMOTE = remoteInfo
export default remoteInfo
