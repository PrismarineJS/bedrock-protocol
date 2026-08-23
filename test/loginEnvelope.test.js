/* eslint-env mocha */

const assert = require('assert')
const { parseLoginEnvelope } = require('../src/auth/loginEnvelope')

function packet (identity, client = 'client-data') {
  return {
    data: {
      params: {
        protocol_version: 123,
        tokens: {
          identity: typeof identity === 'string' ? identity : JSON.stringify(identity),
          client
        }
      }
    }
  }
}

describe('login envelope parsing', () => {
  it('parses legacy and modern certificate shapes without making trust decisions', () => {
    const legacy = parseLoginEnvelope(packet({ chain: ['one'] }))
    assert.deepStrictEqual(legacy, {
      protocolVersion: 123,
      chain: ['one'],
      multiplayerToken: '',
      clientDataToken: 'client-data'
    })

    const modern = parseLoginEnvelope(packet({
      AuthenticationType: 0,
      Certificate: JSON.stringify({ chain: ['one', 'two', 'three'] }),
      Token: 'oidc-token'
    }))
    assert.deepStrictEqual(modern, {
      protocolVersion: 123,
      chain: ['one', 'two', 'three'],
      multiplayerToken: 'oidc-token',
      clientDataToken: 'client-data'
    })
  })

  it('rejects guest, malformed, and incomplete envelopes', () => {
    assert.throws(() => parseLoginEnvelope(packet({ AuthenticationType: 1, Token: 'value' })), /Guest authentication/)
    assert.throws(() => parseLoginEnvelope(packet('{not-json')), /invalid JSON/)
    assert.throws(() => parseLoginEnvelope(packet({ Certificate: '{not-json' })), /Certificate is invalid JSON/)
    assert.throws(() => parseLoginEnvelope(packet({})), /missing its chain or Certificate/)
    assert.throws(() => parseLoginEnvelope(packet({ chain: 'not-an-array' })), /chain must be an array/)
    assert.throws(() => parseLoginEnvelope(packet({ chain: [] }, '')), /missing its client-data token/)
  })
})
