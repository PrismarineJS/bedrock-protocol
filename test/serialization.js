const { createDeserializer, createSerializer } = require('../src/transforms/serializer')

function test() {
  const serializer = createSerializer()
  const deserializer = createDeserializer()

  function write(name, params) {
    const packet = serializer.createPacketBuffer({ name, params })
    console.log('Encoded', packet)
    return packet
  }

  function read(packet) {
    const des = deserializer.parsePacketBuffer(packet)
    return des
  }

  async function creativeTest() {
    let CreativeItems = require('../../data/creativeitems.json')

    let items = []
    let ids = 0
    for (var item of CreativeItems) {
      let creativeitem = { runtime_id: items.length }
      if (item.id != 0) {
        const hasNbt = !!item.nbt_b64
        creativeitem.item = {
          network_id: item.id,
          auxiliary_value: item.damage || 0,
          has_nbt: hasNbt,
          nbt: { version: 1 },
          blocking_tick: 0,
          can_destroy: [],
          can_place_on: []
        }
        if (hasNbt) {
          let nbtBuf = Buffer.from(item.nbt_b64, 'base64')
          let { result } = await NBT.parse(nbtBuf, 'little')

          const buf = NBT.writeUncompressed(result, 'littleVarint')

          console.log(nbtBuf, buf, JSON.stringify(result))

          console.log('\n')

          let res2 = await NBT.parse(buf, 'littleVarint')
          console.log(JSON.stringify(result), JSON.stringify(res2.result))
          console.assert(JSON.stringify(result) == JSON.stringify(res2.result), JSON.stringify(result), JSON.stringify(res2.result))

          console.log('\n')

          creativeitem.item.nbt.nbt = result
        }
      }

      items.push(creativeitem)
      console.log(JSON.stringify(creativeitem))
      // console.log(JSON.stringify(creativeitem))

      var s = write('creative_content', { items: [creativeitem] })
      var d = read(s).data.params

      // console.log(JSON.stringify(d), JSON.stringify(s))
      // if (JSON.stringify(d) != JSON.stringify(creative_content)) throw 'mismatch'
    }
  }

  async function creativeTst() {
    var creativeitem = {
      "runtime_id": 1166,
      "item": {
        "network_id": 403,
        "auxiliary_value": 0,
        "has_nbt": true,
        "nbt": {
          "version": 1,
          "nbt": {
            "type": "compound",
            "name": "",
            "value": {
              "ench": {
                "type": "list",
                "value": {
                  "type": "compound",
                  "value": [
                    {
                      "id": {
                        "type": "short",
                        "value": 0
                      },
                      "lvl": {
                        "type": "short",
                        "value": 1
                      }
                    }
                  ]
                }
              }
            }
          }
        },
        "blocking_tick": 0,
        "can_destroy": [],
        "can_place_on": []
      }
    }

    var s = write('creative_content', { items: [creativeitem] })
    var d = read(s).data.params
    console.log(JSON.stringify(d))
  }

  async function availableCommands() {
    var avaliable = {
      enum_values: ['true', 'false'],
      suffixes: ['L'],
      enums: [
        {
          name: 'Boolean',
          values_len: 2,
          values: [0, 1]
        }
      ],
      command_data: [
        {
          name: 'give',
          description: 'Gives you items',
          flags: 0,
          permission_level: 0,
          alias: -1,
          overloads: [
            [
              { paramater_name: 'player id', paramater_type: 2, optional: false, flags: { "collapse_enum": 1 } }
            ],
            [
              { paramater_name: 'item id', paramater_type: 2, optional: false, flags: 0 },
            ]
          ],
        },
        {
          name: 'xp',
          description: 'Gives you xp',
          flags: 0, permission_level: 0, alias: -1,
          overloads: [
            [{ paramater_name: 'player id', paramater_type: 2, optional: false, flags: 0 }]
          ]
        }
      ],
      enum_constraints: [
        {
          value_index: 2, enum_index: 3, constraints: [
            { constraint: 'cheats_enabled' }
          ]
        },
      ],
      dynamic_enums: [
        { name: 'Hello', values: ['yolo', 'yee'] }
      ]
    }

    var s = write('available_commands', avaliable)
    var d = read(s).data.params
    console.log(JSON.stringify(d, null, 2))
  }

  // creativeTst()
  availableCommands()
}

if (!module.parent) {
  test()
}