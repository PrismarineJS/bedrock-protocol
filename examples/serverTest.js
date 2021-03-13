const fs = require('fs')
process.env.DEBUG = 'minecraft-protocol raknet'
const { Server } = require('../src/server')
// const CreativeItems = require('../data/creativeitems.json')
const DataProvider = require('../data/provider')

const server = new Server({

})
server.create('0.0.0.0', 19132)

function getPath (packetPath) {
  return DataProvider(server.options.protocolVersion).getPath(packetPath)
}

function get (packetPath) {
  return require(getPath('sample/' + packetPath))
}

// const ran = false

server.on('connect', ({ client }) => {
  /** @type {Player} */
  client.on('join', () => {
    console.log('Client joined', client.getData())

    // ResourcePacksInfo is sent by the server to inform the client on what resource packs the server has. It
    // sends a list of the resource packs it has and basic information on them like the version and description.
    client.write('resource_packs_info', {
      must_accept: false,
      has_scripts: false,
      behaviour_packs: [],
      texture_packs: []
    })

    client.once('resource_pack_client_response', async (packet) => {
      // ResourcePackStack is sent by the server to send the order in which resource packs and behaviour packs
      // should be applied (and downloaded) by the client.
      client.write('resource_pack_stack', {
        must_accept: false,
        behavior_packs: [],
        resource_packs: [],
        game_version: '',
        experiments: [],
        experiments_previously_used: false
      })

      client.once('resource_pack_client_response', async (packet) => {

      })

      client.write('network_settings', {
        compression_threshold: 1
      })

      for (let i = 0; i < 3; i++) {
        client.queue('inventory_slot', { inventory_id: 120, slot: i, uniqueid: 0, item: { network_id: 0 } })
      }

      client.queue('inventory_transaction', get('packets/inventory_transaction.json'))
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
      client.queue('player_hotbar', { selected_slot: 3, window_id: 0, select_slot: true })

      client.queue('crafting_data', get('packets/crafting_data.json'))
      client.queue('available_commands', get('packets/available_commands.json'))
      client.queue('chunk_radius_update', { chunk_radius: 5 })

      client.queue('set_entity_data', get('packets/set_entity_data.json'))

      client.queue('game_rules_changed', get('packets/game_rules_changed.json'))
      client.queue('respawn', { x: 646.9405517578125, y: 65.62001037597656, z: 77.86255645751953, state: 0, runtime_entity_id: 0 })

      for (const file of fs.readdirSync(`../data/${server.options.version}/sample/chunks`)) {
        const buffer = Buffer.from(fs.readFileSync(`../data/${server.options.version}/sample/chunks/` + file, 'utf8'), 'hex')
        // console.log('Sending chunk', chunk)
        client.sendBuffer(buffer)
      }

      // for (const chunk of chunks) {
      //   client.queue('level_chunk', chunk)
      // }

      setInterval(() => {
        client.write('network_chunk_publisher_update', { coordinates: { x: 646, y: 130, z: 77 }, radius: 64 })
      }, 9500)

      setTimeout(() => {
        client.write('play_status', { status: 'player_spawn' })
      }, 8000)

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

// CHUNKS
// const { ChunkColumn, Version } = require('bedrock-provider')
// const mcData = require('minecraft-data')('1.16')
// const chunks = []
// async function buildChunks () {
//   // "x": 40,
//   // "z": 4,

//   const stone = mcData.blocksByName.stone

//   for (let cx = 35; cx < 45; cx++) {
//     for (let cz = 0; cz < 8; cz++) {
//       const column = new ChunkColumn(Version.v1_2_0_bis, x, z)
//       for (let x = 0; x < 16; x++) {
//         for (let y = 0; y < 60; y++) {
//           for (let z = 0; z < 16; z++) {
//             column.setBlock(x, y, z, stone)
//           }
//         }
//       }

//       const ser = await column.networkEncodeNoCache()

//       chunks.push({
//         x: cx,
//         z: cz,
//         sub_chunk_count: column.sectionsLen,
//         cache_enabled: false,
//         blobs: [],
//         payload: ser
//       })
//     }
//   }

//   // console.log('Chunks',chunks)
// }

// // buildChunks()
