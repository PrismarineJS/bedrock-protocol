const { Server, Client } = require('../')
const { dumpPackets } = require('../tools/genPacketDumps')
const DataProvider = require('../data/provider')
const { ping } = require('../src/createClient')
const { CURRENT_VERSION } = require('../src/options')

// First we need to dump some packets that a vanilla server would send a vanilla
// client. Then we can replay those back in our custom server.
function prepare (version) {
  return dumpPackets(version)
}

async function startTest (version = CURRENT_VERSION, ok) {
  await prepare(version)
  const Item = require('../types/Item')(version)
  const port = 19130
  const server = new Server({ host: '0.0.0.0', port, version, offline: true })

  function getPath (packetPath) {
    return DataProvider(server.options.protocolVersion).getPath(packetPath)
  }

  function get (packetPath) {
    return require(getPath('sample/' + packetPath))
  }

  server.listen()
  console.log('Started server')

  const pongData = await ping({ host: '127.0.0.1', port })
  console.assert(pongData, 'did not get valid pong data from server')

  const respawnPacket = get('packets/respawn.json')
  const chunks = await requestChunks(respawnPacket.x, respawnPacket.z, 1)

  let loop

  // server logic
  server.on('connect', client => {
    client.on('join', () => {
      console.log('Client joined server', client.getUserData())

      client.write('resource_packs_info', {
        must_accept: false,
        has_scripts: false,
        behaviour_packs: [],
        texture_packs: []
      })

      client.once('resource_pack_client_response', async rp => {
        // Tell the server we will compress everything (>=1 byte)
        client.write('network_settings', { compression_threshold: 1 })
        // Send some inventory slots
        for (let i = 0; i < 3; i++) {
          client.queue('inventory_slot', { window_id: 'armor', slot: 0, item: new Item().toBedrock() })
        }

        // client.queue('inventory_transaction', get('packets/inventory_transaction.json'))
        client.queue('player_list', get('packets/player_list.json'))
        client.queue('start_game', get('packets/start_game.json'))
        client.queue('item_component', { entries: [] })
        client.queue('set_spawn_position', get('packets/set_spawn_position.json'))
        client.queue('set_time', { time: 5433771 })
        client.queue('set_difficulty', { difficulty: 1 })
        client.queue('set_commands_enabled', { enabled: true })
        client.queue('adventure_settings', get('packets/adventure_settings.json'))

        client.queue('biome_definition_list', get('packets/biome_definition_list.json'))
        client.queue('available_entity_identifiers', get('packets/available_entity_identifiers.json'))

        client.queue('update_attributes', get('packets/update_attributes.json'))
        client.queue('creative_content', get('packets/creative_content.json'))
        client.queue('inventory_content', get('packets/inventory_content.json'))

        client.queue('player_hotbar', { selected_slot: 3, window_id: 'inventory', select_slot: true })

        client.queue('crafting_data', get('packets/crafting_data.json'))
        client.queue('available_commands', get('packets/available_commands.json'))
        client.queue('chunk_radius_update', { chunk_radius: 5 })

        // client.queue('set_entity_data', get('packets/set_entity_data.json'))

        client.queue('game_rules_changed', get('packets/game_rules_changed.json'))
        client.queue('respawn', get('packets/respawn.json'))

        for (const chunk of chunks) {
          client.queue('level_chunk', chunk)
        }

        loop = setInterval(() => {
          client.write('network_chunk_publisher_update', { coordinates: { x: 646, y: 130, z: 77 }, radius: 64 })
        }, 9500)

        setTimeout(() => {
          client.write('play_status', { status: 'player_spawn' })
        }, 6000)

        // Respond to tick synchronization packets
        client.on('tick_sync', (packet) => {
          client.queue('tick_sync', {
            request_time: packet.request_time,
            response_time: BigInt(Date.now())
          })
        })
      })
    })
  })

  // client logic
  const client = new Client({
    host: '127.0.0.1',
    port,
    username: 'Notch',
    version,
    offline: true
  })

  console.log('Started client')

  client.once('resource_packs_info', (packet) => {
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

    client.queue('client_cache_status', { enabled: false })
    client.queue('request_chunk_radius', { chunk_radius: 1 })
    client.queue('tick_sync', { request_time: BigInt(Date.now()), response_time: 0n })
  })

  client.once('spawn', () => {
    console.info('Client spawend!')
    setTimeout(() => {
      client.close()

      server.close().then(() => {
        ok?.()
      })
    }, 500)
    clearInterval(loop)
  })

  client.connect()
}

const { ChunkColumn, Version } = require('bedrock-provider')
const { waitFor } = require('../src/datatypes/util')
const mcData = require('minecraft-data')('1.16')

async function requestChunks (x, z, radius) {
  const cxStart = (x >> 4) - radius
  const cxEnd = (x >> 4) + radius
  const czStart = (z >> 4) - radius
  const czEnd = (z >> 4) + radius

  const stone = mcData.blocksByName.stone
  const chunks = []

  for (let cx = cxStart; cx < cxEnd; cx++) {
    for (let cz = czStart; cz < czEnd; cz++) {
      console.log('reading chunk at ', cx, cz)
      const cc = new ChunkColumn(Version.v1_2_0_bis, x, z)

      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 60; y++) {
          for (let z = 0; z < 16; z++) {
            cc.setBlock(x, y, z, stone)
          }
        }
      }

      if (!cc) {
        console.log('no chunk')
        continue
      }
      const cbuf = await cc.networkEncodeNoCache()
      chunks.push({
        x: cx,
        z: cz,
        sub_chunk_count: cc.sectionsLen,
        cache_enabled: false,
        blobs: [],
        payload: cbuf
      })
      // console.log('Ht',cc.sectionsLen,cc.sections)
    }
  }

  return chunks
}

async function timedTest (version, timeout = 1000 * 220) {
  await waitFor((res) => {
    startTest(version, res)
  }, timeout, () => {
    throw Error('timed out')
  })
  console.info('✔ ok')
}

if (!module.parent) timedTest()
module.exports = { startTest, timedTest, requestChunks }
