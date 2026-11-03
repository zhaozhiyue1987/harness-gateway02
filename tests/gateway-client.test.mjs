import test from 'node:test'
import assert from 'node:assert/strict'
import { DiscoveryClient, GatewayHttpError, normalizeConsoleUrl } from '../dist/host/gateway-client.js'

test('normalizes private management URL and rejects unsafe components', () => {
  assert.equal(normalizeConsoleUrl('https://gateway.example/console/'), 'https://gateway.example/console')
  assert.throws(() => normalizeConsoleUrl('https://user:pass@gateway.example'), /credentials/)
  assert.throws(() => normalizeConsoleUrl('https://gateway.example/console?token=x'), /query/)
  assert.throws(() => normalizeConsoleUrl('file:///tmp/gateway'), /http or https/)
})

test('exchanges one bearer credential and reads scoped routes with ETag', async () => {
  const calls = []
  const client = new DiscoveryClient('https://gateway.example/console', {
    timeoutMs: 2000,
    fetcher: async (url, init) => {
      calls.push({ url: String(url), init })
      if (String(url).endsWith('/exchange')) return new Response(JSON.stringify({ data: { accessToken: 'short-token', expiresIn: 600 } }), { status: 200 })
      return new Response(JSON.stringify({ data: { schemaVersion: '1', collectionVersion: 'v1', gateway: { instanceId: 'gw-1' }, routes: [] } }), { status: 200, headers: { etag: 'v1' } })
    },
  })
  const token = await client.exchange('gateway-key')
  await client.routes(token.accessToken, 'old')
  assert.equal(calls[0].init.headers.authorization, 'Bearer gateway-key')
  assert.equal(calls[1].init.headers.authorization, 'Bearer short-token')
  assert.equal(calls[1].init.headers['if-none-match'], 'old')
})

test('maps 401 uniformly and never exposes response body', async () => {
  const client = new DiscoveryClient('https://gateway.example', { timeoutMs: 2000, fetcher: async () => new Response(JSON.stringify({ message: 'secret registry detail' }), { status: 401 }) })
  await assert.rejects(() => client.exchange('bad-key'), error => error instanceof GatewayHttpError && error.code === 'AUTH_REQUIRED' && error.message === 'authentication failed' && !error.message.includes('secret'))
})

test('rejects redirects before following them', async () => {
  const client = new DiscoveryClient('https://gateway.example', { timeoutMs: 2000, fetcher: async (_url, init) => { assert.equal(init.redirect, 'error'); return new Response(null, { status: 302, headers: { location: 'https://evil.example' } }) } })
  await assert.rejects(() => client.exchange('key'), /gateway discovery request failed/)
})
