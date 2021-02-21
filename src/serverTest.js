// process.env.DEBUG = 'minecraft-protocol raknet'
const { Server } = require('./server')
const CreativeItems = require('../data/creativeitems.json')
const NBT = require('prismarine-nbt')
const fs = require('fs')

let server = new Server({

})
server.create('0.0.0.0', 19132)

let ran = false

server.on('connect', ({ client }) => {
  /** @type {Player} */
  client.on('join', () => {
    console.log('Client joined', client.getData())

    // ResourcePacksInfo is sent by the server to inform the client on what resource packs the server has. It
    // sends a list of the resource packs it has and basic information on them like the version and description.
    client.write('resource_packs_info', {
      'must_accept': false,
      'has_scripts': false,
      'behaviour_packs': [],
      'texture_packs': []
    })

    client.once('resource_pack_client_response', async (packet) => {
      // ResourcePackStack is sent by the server to send the order in which resource packs and behaviour packs
      // should be applied (and downloaded) by the client.
      client.write('resource_pack_stack', {
        'must_accept': false,
        'behavior_packs': [],
        'resource_packs': [],
        'game_version': '',
        'experiments': [],
        'experiments_previously_used': false
      })

      client.once('resource_pack_client_response', async (packet) => {
        // ran = true
        // let items = []
        // let ids = 0
        // for (var item of CreativeItems) {
        //   let creativeitem = { runtime_id: items.length }
        //   const has_nbt = !!item.nbt_b64
        //   if (item.id != 0) {
        //     creativeitem.item = { 
        //       network_id: item.id,
        //       auxiliary_value: item.damage || 0,
        //       has_nbt,
        //       nbt: {
        //         version: 1,
        //       },
        //       blocking_tick: 0,
        //       can_destroy: [],
        //       can_place_on: []
        //     }
        //     if (has_nbt) {
        //       let nbtBuf = Buffer.from(item.nbt_b64, 'base64')
        //       let { parsed } = await NBT.parse(nbtBuf, 'little')
        //       creativeitem.item.nbt.nbt = parsed
        //     }
        //   }
        //   items.push(creativeitem)
        //   // console.log(creativeitem)
        // }

        // console.log(items, ids)

        // client.write('creative_content', { items })
        // wait a bit just for easier debugging
        // setTimeout(() => {
        //   const biomeDefs = fs.readFileSync('../data/biome_definitions.nbt')
        //   client.writeRaw('biome_definition_list', biomeDefs)

        //     // TODO: send chunks so we can spawn player
        // }, 1000)

      })

      client.write('network_settings', {
        compression_threshold: 1
      })

      for (let i = 0; i < 3; i++) {
        client.queue('inventory_slot', {"inventory_id":120,"slot":i,"uniqueid":0,"item":{"network_id":0}})
      }

      client.queue('inventory_transaction', require('./packets/inventory_transaction.json'))
      client.queue('player_list', require('./packets/player_list.json'))
      client.queue('start_game', require('./packets/start_game.json'))
      client.queue('item_component', {"entries":[]})
      client.queue('set_time', { time: 5433771 })
      client.queue('set_difficulty', { difficulty: 1 })
      client.queue('set_commands_enabled', { enabled: true })
      client.queue('adventure_settings', require('./packets/adventure_settings.json'))
      
      client.queue('biome_definition_list', require('./packets/biome_definition_list.json'))
      client.queue('available_entity_identifiers', require('./packets/available_entity_identifiers.json'))

      client.queue('update_attributes', require('./packets/update_attributes.json'))
      client.queue('creative_content', require('./packets/creative_content.json'))
      client.queue('player_hotbar', {"selected_slot":3,"window_id":0,"select_slot":true})

      client.queue('crafting_data', require('./packets/crafting_data.json'))
      client.queue('available_commands', require('./packets/available_commands.json'))

      client.queue('game_rules_changed', require('./packets/game_rules_changed.json'))
      client.queue('respawn', {"x":646.9405517578125,"y":65.62001037597656,"z":77.86255645751953,"state":0,"runtime_entity_id":0})

      for (const file of fs.readdirSync('chunks')) {
        const buffer = Buffer.from(fs.readFileSync('./chunks/' + file, 'utf8'), 'hex')
        // console.log('Sending chunk', chunk)
        client.sendBuffer(buffer)
      }

      setInterval(() => {
        client.write('network_chunk_publisher_update', {"coordinates":{"x":646,"y":130,"z":77},"radius":64})
      }, 9500)


      setTimeout(() => {
        client.write('play_status', { status: 'player_spawn' })
      }, 8000)
    })
  })
})

async function sleep(ms) {
  return new Promise(res => {
    setTimeout(() => { res() }, ms)
  })
}