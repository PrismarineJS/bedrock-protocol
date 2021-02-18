import raknet from 'raknet';
import zlib from 'zlib';
import jwt from 'jwt-simple';
import { ProtoDef, Parser, Serializer } from 'protodef';

let batchProto = new ProtoDef();
const PUBLIC_KEY = 'MHYwEAYHKoZIzj0CAQYFK4EEACIDYgAE8ELkixyLcwlZryUQcu1TvPOmI2B7vX83ndnWRUaXm74wFfa5f/lwQNTfrLVHa2PmenpGI6JhIMUJaWZrjmMj90NoKNFSNBuKdm8rYiXsfaz3K36x/1U26HpG0ZxK/V1V';

// createServer (object, boolean)
//
// Create & launch a MCPE raknet-based server.
// object: raknet options
// encryption: enable/disable encryption
function createServer(options, encryption) {
    options = options || {};

    const port = options.port || options['server-port'] || 19132;
    const host = options.host || '0.0.0.0';

    options.customPackets = (options.protocol ? options.protocol.packets : null) || require('../data/protocol');
    options.customTypes = (options.protocol ? options.protocol.types : null) || require('./datatypes/minecraft');

    batchProto.addTypes(options.customTypes);
    batchProto.addType('insideBatch', ['endOfArray', {
        'type': ['buffer', {
            'countType': 'varint',
        }]
    }]);

    let server = raknet.createServer(options);
    server.name = options.name || 'Minecraft Server';
    server.motd = options.motd || 'A Minecraft server'; //FIXME
    server.maxPlayers = options['max-players'] || 20; //FIXME
    server.playerCount = 0; //FIXME

    server.on('connection', (client) => {
        client.receiveCounter = 0;
        client.sendCounter = 0;
        client.encryptionEnabled = encryption ? true : false;

        let proto = new ProtoDef();
        proto.addTypes(options.customTypes);
        proto.addTypes(options.customPackets.types);
        client.mcpePacketSerializer = new Serializer(proto, 'mcpe_packet');

        client.on('mcpe', packet => {
            client.emit(packet.name, packet.params);
            client.emit('debug', packet.name);
        });
        client.on('batch', function (packets) {
            var buf = zlib.inflateSync(packets.payload);
            var packets = batchProto.parsePacketBuffer('insideBatch', buf).data;
            packets.forEach(packet => client.readEncapsulatedPacket(Buffer.concat([new Buffer([0xfe]), packet])));
        });

        // client.writePacket (string, object)
        // Send data to the client
        //
        // string: packet name
        // object: packet data
        client.writeMCPE = (name, params) => {
            if (client.encryptionEnabled) {
                client.mcpePacketSerializer.write({ name, params });
            } else {
                client.writeEncapsulated('mcpe', { name, params });
            }
        };
        client.writePacket = client.writeMCPE;

        // client.writeData (array)
        // Send data to the client
        //
        // array: packets to send
        client.writeBatch = (packets) => {
            const payload = zlib.deflateSync(batchProto.createPacketBuffer('insideBatch',
                packets.map(packet => client.mcpePacketSerializer.createPacketBuffer(packet))));

            client.writePacket('batch', {
                payload: payload
            });
        };
        client.writeData = client.writeBatch;

        // client.writeAll (string, object)
        // Send data to the client
        //
        // string: packet name
        // object: packet data
        client.writeAll = (name, data) => {
            server._writeAll(name, data);
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
                console.log(packet);
                let body = dataProto.parsePacketBuffer('data_chain', zlib.inflateSync(packet.body)),
                    chain = null,
                    decode = null,
                    data = null;

                body.data.chain = JSON.parse(body.data.chain);
                chain = body.data.chain.chain[0];

                decode = jwt.decode(chain, PUBLIC_KEY, 'ES384');
                data = jwt.decode(body.data.clientData, decode.identityPublicKey, 'ES384');

                client.emit('mcpe_login', {
                    protocol: packet.protocol,
                    uuid: (decode.extraData != null) ? decode.extraData.identity : null,
                    id: (decode.extraData != null) ? decode.extraData.identityPublicKey : null,
                    username: (decode.extraData != null) ? decode.extraData.displayName : null,
                    skinData: data.SkinData,
                    skinId: data.SkinId
                })
            } catch (err) {
                console.error(err);
                return null;
            }
        });
    });
    return server;
}

module.exports = createServer;
