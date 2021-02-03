const { Server } = require('./server')
const CreativeItems = require('../data/creativeitems.json')
const NBT = require('prismarine-nbt')
const fs = require('fs')

let server = new Server({

})
server.create('0.0.0.0', 19130)

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

    client.once('resource_pack_client_response', (packet) => {
      // ResourcePackStack is sent by the server to send the order in which resource packs and behaviour packs
      // should be applied (and downloaded) by the client.
      client.write('resource_pack_stack', {
        'must_accept': false,
        'behavior_packs': [],
        'resource_packs': [],
        'game_version': '',
        'experiments': [],
        'experiments_previously_toggled': false
      })

      client.once('resource_pack_client_response', async (packet) => {
        ran = true
        let items = []
        let ids = 0
        for (var item of CreativeItems) {
          let creativeitem = { runtime_id: items.length }
          if (item.id != 0) {
            const hasNbt = !!item.nbt_b64
            creativeitem.item = { 
              network_id: item.id,
              auxiliary_value: item.damage || 0,
              has_nbt: hasNbt|0,
              nbt_version: 1,
              blocking_tick: 0,
              can_destroy: [],
              can_place_on: []
            }
            if (hasNbt) {
              let nbtBuf = Buffer.from(item.nbt_b64, 'base64')
              let { result } = await NBT.parse(nbtBuf, 'little')
              creativeitem.item.nbt = result
            }
          }
          items.push(creativeitem)
          // console.log(creativeitem)
        }

        console.log(items, ids)

        client.write('creative_content', { items })
        // wait a bit just for easier debugging
        setTimeout(() => {
          const biomeDefs = fs.readFileSync('../data/biome_definitions.nbt')
          client.writeRaw('biome_definition_list', biomeDefs)

            // TODO: send chunks so we can spawn player
        }, 1000)
      })
    })
  })
})