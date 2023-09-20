/**
 * This example spawns a client. For a basic server that disconnects users, see "basicServer.js".
 *
 * bedrock-protocol server example; to run this example you need to clone this repo from git.
 * first need to dump some packets from the vanilla server as there is alot of boilerplate
 * to send to clients. The `serverChunks.js` contains the chunk loading code.
 *
 * In your server implementation, you need to implement each of the following packets to
 * get a client to spawn like vanilla. You can look at the dumped packets in `data/1.16.10/sample`
 *
 * First, dump packets for version 1.16.210 by running `npm run dumpPackets`.
 * Then you can run `node server.js <version>` to start this script.
 */
process.env.DEBUG = 'minecraft-protocol' // packet logging
// const fs = require('fs')
const { Server } = require('bedrock-protocol')

const { hasDumps } = require('../../tools/genPacketDumps')
const { waitFor } = require('../../src/datatypes/util')
const { loadWorld } = require('./serverChunks')
const { join } = require('path')

async function startServer (version = '1.17.10', ok) {
  if (!hasDumps(version)) {
    throw Error('You need to dump some packets first. Run tools/genPacketDumps.js')
  }

  const Item = require('../../types/Item')(version)
  const port = 19132
  const server = new Server({ host: '0.0.0.0', port, version })
  let loop

  const getPath = (packetPath) => join(__dirname, `../data/${server.options.version}/${packetPath}`)
  const get = (packetName) => require(getPath(`sample/packets/${packetName}.json`))

  server.listen()
  console.log('Started server')

  // Find the center position from the dumped packets
  const respawnPacket = get('respawn')
  const world = await loadWorld(version)
  const chunks = await world.requestChunks(respawnPacket.x, respawnPacket.z, 2)

  // Connect is emitted when a client first joins our server, before authing them
  server.on('connect', client => {
    // Join is emitted after the client has been authenticated and encryption has started
    client.on('join', () => {
      console.log('Client joined', client.getUserData())

      // ResourcePacksInfo is sent by the server to inform the client on what resource packs the server has. It
      // sends a list of the resource packs it has and basic information on them like the version and description.
      client.write('resource_packs_info', {
        must_accept: false,
        has_scripts: false,
        behaviour_packs: [],
        texture_packs: [],
        resource_pack_links: []
      })

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

      client.once('resource_pack_client_response', async rp => {
        // Tell the server we will compress everything (>=1 byte)
        client.write('network_settings', { compression_threshold: 1 })
        // Send some inventory slots
        for (let i = 0; i < 3; i++) {
          client.queue('inventory_slot', { window_id: 120, slot: 0, item: new Item().toBedrock() })
        }

        client.queue('player_list', get('player_list'))
        client.queue('start_game', get('start_game'))
        client.queue('item_component', { entries: [] })
        client.queue('set_spawn_position', get('set_spawn_position'))
        client.queue('set_time', { time: 5433771 })
        client.queue('set_difficulty', { difficulty: 1 })
        client.queue('set_commands_enabled', { enabled: true })
        client.queue('adventure_settings', get('adventure_settings'))
        client.queue('biome_definition_list', get('biome_definition_list'))
        client.queue('available_entity_identifiers', get('available_entity_identifiers'))
        client.queue('update_attributes', get('update_attributes'))
        client.queue('creative_content', get('creative_content'))
        client.queue('inventory_content', get('inventory_content'))
        client.queue('player_hotbar', { selected_slot: 3, window_id: 'inventory', select_slot: true })
        client.queue('crafting_data', get('crafting_data'))
        client.queue('available_commands', get('available_commands'))
        client.queue('chunk_radius_update', { chunk_radius: 1 })
        client.queue('game_rules_changed', get('game_rules_changed'))
        client.queue('respawn', get('respawn'))

        for (const chunk of chunks) {
          client.queue('level_chunk', chunk)
        }

        // Uncomment below and comment above to send dumped chunks. We use bedrock-provider in this example which is still a WIP, some blocks may be broken.
        // for (const file of fs.readdirSync(`../data/${server.options.version}/sample/chunks`)) {
        //   const buffer = fs.readFileSync(`../data/${server.options.version}/sample/chunks/` + file)
        //   // console.log('Sending chunk', buffer)
        //   client.sendBuffer(buffer)
        // }

        // Constantly send this packet to the client to tell it the center position for chunks. The client should then request these
        // missing chunks from the us if it's missing any within the radius. `radius` is in blocks.
        loop = setInterval(() => {
          client.write('network_chunk_publisher_update', { coordinates: { x: respawnPacket.x, y: 130, z: respawnPacket.z }, radius: 80 })
        }, 4500)

        // Wait some time to allow for the client to recieve and load all the chunks
        setTimeout(() => {
          // Allow the client to spawn
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

  ok()

  return {
    kill: () => {
      clearInterval(loop)
      server.close()
    }
  }
}

let server
waitFor((res) => {
  server = startServer(process.argv[2], res)
}, 1000 * 60 /* Wait 60 seconds for the server to start */, function onTimeout () {
  console.error('Server did not start in time')
  server?.close()
  process.exit(1)
})
