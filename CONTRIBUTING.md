CONTRIBUTING.md

Contributions are always welcome :). If you have any questions, please discuss on the Discord or in a Discussion.

## Updating

Good sources for the Minecraft bedrock protocol are [gophertunnel](https://github.com/Sandertv/gophertunnel/tree/master/minecraft/protocol/packet), [ClouburstMC's protocol library](https://github.com/CloudburstMC/Protocol) and [PocketMine](https://github.com/pmmp/PocketMine-MP/tree/stable/src/pocketmine/network/mcpe/protocol).

Protocol updates need to happen in two places: in minecraft-data to update the protocol schema (the actual data structures for the packets) and here in the protocol library side. If no changes to the underlying protocol are made aside from packet structure changes (add, remove, modify packets) then the only change needed in bedrock-protocol is to update the README documentation and some constants in `src/options.js` (update the CURRENT_VERSION).

Steps to update:
* Update the protocol data in minecraft-data : see the instructions [here](https://github.com/PrismarineJS/minecraft-data/blob/master/doc/bedrock.md).
  * Find the relevant changes to the protocol for the current version
  * Update the [.YML files](https://github.com/PrismarineJS/minecraft-data/tree/master/data/bedrock/latest) in minecraft-data accordingly (see the [Packet serialization](#Packet_serialization) notes at the bottom here for info on syntax)
  * Then follow the steps to build the protocol .YML files into JSON
  * Do a release of the minecraft-data package
* Add the version to `src/options.js` here
* Run `npm run build` and `npm test` to test that everything is OK

### Development

For development purposes, you can easily alter the protocol locally without a remote minecraft-data release :
* Run `npm install` on the root of this repo after git cloning
* Open `node_modules/minecraft-data/minecraft-data/data/bedrock/latest/` and update the .YML files as you need, following the schema at the bottom (make sure to update '!version' if you are changing version)
* Go back to the root of this repo and run `npm run build`. 
* Then `npm test` ; the protocol changes should be automatically applied

For example, [here](https://github.com/PrismarineJS/minecraft-data/pull/467/files) is a PR for the update to 1.17.30 in minecraft-data - [here](https://github.com/PrismarineJS/bedrock-protocol/pull/150/files) is an accompanying change for bedrock-protocol.

## Code structure

The code structure is similar to node-minecraft-protocol. For raknet, raknet-native is used for Raknet communication.

## Packet serialization

This project uses ProtoDef to serialize and deserialize Minecraft packets. See the documentation [here](https://github.com/ProtoDef-io/node-protodef).
The ProtoDef schema is JSON can be found [here](https://github.com/PrismarineJS/bedrock-protocol/blob/4169453835790de7eeaa8fb6f5a6b4344f71036b/data/1.16.210/protocol.json) for use in other languages.

In bedrock-protocol, JavaScript code is generated from the JSON through the node-protodef compiler.

#### YAML syntax

For easier maintainability, the JSON is generated from a more human readable YAML format. You can read more [here](https://github.com/extremeheat/protodef-yaml).
 Some documentation is below.

Packets should go in proto.yml and extra types should go in types.yml.

```yml
# This defines a new data structure, a ProtoDef container.
Position:
    # Variable `x` in this struct has a type of `li32`, a little-endian 32-bit integer
    x: li32
    # `z` is a 32-bit LE *unsigned* integer
    z: lu32
    # `b` is a 32-bit LE floating point
    y: lf32

# Fields starting with `packet_` are structs representing Minecraft packets
packet_player_position:
    # Fields starting with ! are ignored by the parser. '!id' is used by the parser when generating the packet map
    !id: 0x29 # This packet is ID #0x29
    !bound: client # `client` or `server` bound, just for documentation purposes. This has no other effect.

    # Read `on_ground` as a boolean
    on_ground: bool
    # Read `position` as custom data type `Position` defined above.
    position: Position

    # Reads a 8-bit unsigned integer, then maps it to a string
    movement_reason: u8 =>
        0: player_jump
        1: player_autojump
        2: player_sneak
        3: player_sprint
        4: player_fall
   
   # A `_` as a field name declares an anonymous data structure which will be inlined. Adding a '?' at the end will start a `switch` statement 
    _: movement_reason ?
        # if the condition matches to the string "player_jump" or "player_autojump", there is a data struct that needs to be read
        if player_jump or player_autojump:
            # read `original_position` as a `Position`
            original_position: Position
            jump_tick: li64
        # if the condition matches "player_fall", read the containing field
        if player_fall:
            original_position: Position
        default: void
   
    # Another way to declare a switch, without an anonymous structure. `player_hunger` will be read as a 8-bit int if movement_reason == "player_sprint"
    player_hunger: movement_reason ?
        if player_sprint: u8
        # The default statement as in a switch statement
        default: void

    # Square brackets notate an array. At the left is the type of the array values, at the right is the type of
    # the length prefix. If no type at the left is specified, the type is defined below.

    # Reads an array of `Position`, length-prefixed with a ProtoBuf-type unsigned variable length integer (VarInt)
    last_positions: Position[]varint

    # Reads an array, length-prefixed with a zigzag-encoded signed VarInt  
    # The data structure for the array is defined underneath
    keys_down: []zigzag32
        up: bool
        down: bool
        shift: bool
```

The above roughly translates to the following JavaScript code to read a packet:
```js
function read_position(stream) {
    const ret = {}
    ret.x = stream.readSignedInt32LE()
    ret.z = stream.readUnsignedInt32LE()
    ret.y = stream.readFloat32LE()
    return ret
}

function read_player_position(stream) {
    const ret = {}
    ret.on_ground = Boolean(stream.readU8())
    ret.position = read_player_position(stream)
    let __movement_reason = stream.readU8()
    let movement_reason = { 0: 'player_jump', 1: 'player_autojump', 2: 'player_sneak', 3: 'player_sprint', 4: 'player_fall' }[__movement_reason]
    switch (movement_reason) {
        case 'player_jump':
        case 'player_autojump':
            ret.original_position = read_player_position(stream)
            ret.jump_tick = stream.readInt64LE(stream)
            break
        case 'player_fall':
            ret.original_position = read_player_position(stream)
            break
        default: break
    }
    ret.player_hunger = undefined
    if (movement_reason == 'player_sprint') ret.player_hunger = stream.readU8()
    ret.last_positions = []
    for (let i = 0; i < stream.readUnsignedVarInt(); i++) {
        ret.last_positions.push(read_player_position(stream))
    }
    ret.keys_down = []
    for (let i = 0; i < stream.readZigZagVarInt(); i++) {
        const ret1 = {}
        ret1.up = Boolean(stream.readU8())
        ret1.down = Boolean(stream.readU8())
        ret1.shift = Boolean(stream.readU8())
        ret.keys_down.push(ret1)
    }
    return ret
}
```

and the results in the following JSON for the packet:
```json
{
    "on_ground": false,
    "position": { "x": 0, "y": 2, "z": 0 },
    "movement_reason": "player_jump",
    "original_position": { "x": 0, "y": 0, "z": 0 },
    "jump_tick": 494894984,
    "last_positions": [{ "x": 0, "y": 1, "z": 0 }],
    "keys_down": []
}
```

Custom ProtoDef types can be inlined as JSON:
```yml
string: ["pstring",{"countType":"varint"}]
```
