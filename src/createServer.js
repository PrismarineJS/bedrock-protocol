'use strict';
let raknet      = require('raknet'),
    zlib        = require('zlib'),
    ProtoDef    = require('protodef').ProtoDef,
    Parser      = require('protodef').Parser,
    Serializer  = require('protodef').Serializer,
    jwt         = require('jwt-simple');
var debug = require('debug')('raknet');

let batchProto = new ProtoDef();
batchProto.addTypes(require('./datatypes/minecraft'));
batchProto.addType('insideBatch', ['endOfArray', {
    'type': ['buffer', {
        'countType': 'varint',
    }]
}]);

const PUBLIC_KEY = 'MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE8ELkixyLcwlZryUQcu1TvPOmI2B7vX83ndnWRUaXm74wFfa5f/lwQNTfrLVHa2PmenpGI6JhIMUJaWZrjmMj90NoKNFSNBuKdm8rYiXsfaz3K36x/1U26HpG0ZxK/V1V';

// createServer (object, boolean)
//
// Create & launch a MCPE raknet-based server.
// object: raknet options
// encryption: enable/disable encryption
function createServer(options, encryption) {
    options = options || {};
    const port = options.port != null ?
        options.port :
        options['server-port'] != null ?
        options['server-port'] :
        19132;
    const host = options.host || '0.0.0.0';

    options.customPackets = require('../data/protocol');
    options.customTypes = require('./datatypes/minecraft');
    let server = raknet.createServer(options);

    server.name = options.name || 'Minecraft Server';
    server.motd = options.motd || 'A Minecraft server'; //FIXME
    server.maxPlayers = options['max-players'] || 20; //FIXME
    server.playerCount = 0; //FIXME

    
    server.on('connection', function(client) {
        client.receiveCounter = 0;
        client.sendCounter = 0;
        client.encryptionEnabled = encryption ? encryption : false;

        let proto = new ProtoDef();
        proto.addTypes(require('./datatypes/minecraft'));
        proto.addTypes(require('../data/protocol').types);
        client.mcpePacketSerializer = new Serializer(proto, 'mcpe_packet');
        
        client.on('mcpe', packet => {
            client.emit(packet.name, packet.params)
        });
        client.on('batch', function (packet) {
            var buf = zlib.inflateSync(packet.payload);
            var packets = batchProto.parsePacketBuffer('insideBatch', buf).data;
            packets.forEach(packet => client.readEncapsulatedPacket(Buffer.concat([new Buffer([0xfe]), packet])));
        });

        client.writeMCPE = (name, params) => {
            if (client.encryptionEnabled)
                client.mcpePacketSerializer.write({ name, params });
            else
                client.writeEncapsulated('mcpe', { name, params });
        };
        client.writeBatch = function(packets) {
            const payload = zlib.deflateSync(batchProto.createPacketBuffer('insideBatch',
                packets.map(packet => client.mcpePacketSerializer.createPacketBuffer(packet))));

            client.writeMCPE('batch', {
                payload: payload
            });
        };

        client.on('game_login', (packet) => {
            try {
                let dataProto = new ProtoDef();
                dataProto.addType('data_chain', ['container', [{
                    'name': 'chain',
                    'type': ['pstring', {
                        'countType': 'li32'
                    }]
                }, {
                    'name': 'clientData',
                    'type': ['pstring', {
                        'countType': 'li32'
                    }]
                }]]);

                //FIXME: Xbox & Non-Xbox support
                let body = dataProto.parsePacketBuffer('data_chain', zlib.inflateSync(packet.body)),
                    chain = null,
                    decode = null,
                    data = null;
                
                body.data.chain = JSON.parse(body.data.chain);
                chain = body.data.chain.chain[0];

                decode = jwt.decode(chain, PUBLIC_KEY, 'ES384');
                data = jwt.decode(body.data.clientData, decode.identityPublicKey, 'ES384');

                data.SkinData = null;
                client.emit('mcpe_login', {
                    protocol: packet.protocol,
                    uuid: (decode.extraData != null) ? decode.extraData.identity : null,
                    id: (decode.extraData != null) ? decode.extraData.identityPublicKey : null,
                    username: (decode.extraData != null) ? decode.extraData.displayName : null,
                    skinData: data.SkinData,
                    skinId: data.SkinId
                })
            } catch (err) {
                console.log(err);
                return null;
            }
        });
    });
    return server;
}

module.exports = createServer;
