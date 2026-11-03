import test from 'node:test'
import assert from 'node:assert/strict'
import { credentialRef, modelId, providerId, providerProfile } from '../dist/shared/route-mapper.js'

const route = {
  route: { routeId: 'route-a', name: 'Route A', status: 'READY', configVersion: 'v1' },
  endpoint: { protocol: 'OPENAI_CHAT_COMPLETIONS', baseUrl: 'https://gateway.example/route-a/v1' },
  models: [],
  authentication: { type: 'BEARER' },
  routing: { sessionAffinityEnabled: true, effectivePriority: 'SESSION_AFFINITY_FIRST' },
  eligibility: { connectable: true },
}

test('uses the fixed default model and a connection-scoped credential reference', () => {
  assert.equal(modelId(route), 'higress-default-model')
  assert.equal(credentialRef('c-a'), 'HIGRESS_CREDENTIAL_ROUTES_C_A_KEY')
  assert.notEqual(providerId('c-a', 'gw-1', 'route-a'), providerId('c-b', 'gw-1', 'route-a'))
  assert.deepEqual(providerProfile(route, 'c-a', 'Team A', 'gw-1'), {
    displayName: 'Team A · Route A',
    api: 'openai-completions',
    baseURL: 'https://gateway.example/route-a/v1',
    models: [{ id: 'higress-default-model', name: 'higress-default-model' }],
    apiKeyEnv: 'HIGRESS_CREDENTIAL_ROUTES_C_A_KEY',
  })
})

test('maps every discovered route to an independent provider profile', () => {
  const first = providerProfile({ ...route, models: [{ id: 'deepseek-chat', isDefault: true }] }, 'c-a', 'A', 'gw-1')
  const second = providerProfile({ ...route, models: [{ id: 'deepseek-chat', isDefault: true }] }, 'c-b', 'B', 'gw-1')
  assert.equal(first.models[0].id, 'deepseek-chat')
  assert.equal(first.apiKeyEnv, 'HIGRESS_CREDENTIAL_ROUTES_C_A_KEY')
  assert.equal(second.apiKeyEnv, 'HIGRESS_CREDENTIAL_ROUTES_C_B_KEY')
})
