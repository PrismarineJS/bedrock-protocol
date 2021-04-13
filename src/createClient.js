const { Client } = require('./client')
const assert = require('assert')

module.exports = createClient

/** @param {{ version?: number, hostname: string, port?: number }} options */
function createClient (options) {
  assert(options && options.hostname)
  const client = new Client({ port: 19132, ...options })

  client.once('resource_packs_info', (packet) => {
    handleResourcePackInfo(client)
    disableClientCache(client)
    handleRenderDistance(client)
    handleTickSync(client)
  })

  return client
}

function handleResourcePackInfo (client) {
  client.write('resource_pack_client_response', {
    response_status: 'completed',
    resourcepackids: []
  })

  client.once('resource_pack_stack', (stack) => {
    client.write('resource_pack_client_response', {
      response_status: 'completed',
      resourcepackids: []
    })
  })
}

function handleRenderDistance (client) {
  client.queue('request_chunk_radius', { chunk_radius: 1 })
}

function disableClientCache (client) {
  client.queue('client_cache_status', { enabled: false })
}

function handleTickSync (client) {
  client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: 0n })
}
