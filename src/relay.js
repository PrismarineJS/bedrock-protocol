const { Client } = require('./client')
const { Server } = require('./server')
const { Player } = require('./serverPlayer')

class RelayPlayer extends Player {
    constructor(server, conn) {
        super(server, conn)

        this.startRelaying = false
        this.once('join', () => {
            this.startRelaying = true
            this.flushChunks();
        })

        this.upInLog = this.upOutLog = this.downInLog = this.downOutLog = (...msg) => { }

        this.chunkSendCache = []
        this.sentStartGame = false
        this.pendingUpstreamPackets = []
        this.player_unique_id = -1;

        this.serializer = this.server.serializer;
        this.deserializer = this.server.deserializer;
    }

    forwardToUpstream(data, packet, modified) {
        switch (data.name) {
            case 'client_cache_status':
                this.upstream.write('client_cache_status', { enabled: this.enableChunkCaching })
                return
            case 'set_local_player_as_initialized':
                this.status = 3
                break;
        }

        !modified && packet ? this.upstream.sendBuffer(packet) : this.upstream.write(data.name, data.params)
    }

    flushChunks() {
        if (this.chunkSendCache.length === 0) return;
        while (this.chunkSendCache.length > 0) {
            this.sendBuffer(this.chunkSendCache.shift());
        }
    }

    readUpstream(packet) {
        const packetId = packet[0];

        let des
        try {
            des = this.deserializer.parsePacketBuffer(packet)
        } catch (e) {
            if (packetId === 0x1f) return;
            this.sendBuffer(packet)
            return
        }

        const { name, params } = des.data

        if (name === 'play_status' && params.status === 'login_success') return

        this.emit('clientbound', des.data, des)

        if (!des.canceled) {
            switch (name) {
                case 'start_game':
                    this.player_unique_id = params.entity_id;
                    this.sentStartGame = true
                    this.flushChunks();
                    break;
                case 'level_chunk':
                    if (!this.sentStartGame) {
                        this.chunkSendCache.push(packet);
                        return;
                    }
                    break;
                case 'item_registry':
                    const states = params.itemstates;
                    if (states) {
                        for (let i = 0; i < states.length; i++) {
                            if (states[i].name === 'minecraft:shield') {
                                const rid = states[i].runtime_id;
                                this.serializer.proto.setVariable('ShieldItemID', rid);
                                this.deserializer.proto.setVariable('ShieldItemID', rid);
                                break;
                            }
                        }
                    }
                    break;
                case 'update_player_game_type':
                    if (this.player_unique_id === params.player_unique_id) {
                        this.write("set_player_game_type", { gamemode: params.gamemode });
                    }
                    break
            }

            des.modified ? this.write(name, params) : this.sendBuffer(packet);
        }
    }

    readPacket(packet) {
        if (!this.startRelaying) {
            super.readPacket(packet);
            return;
        }

        let des
        try {
            des = this.deserializer.parsePacketBuffer(packet)
        } catch (e) {
            if (this.upstream) this.upstream.sendBuffer(packet)
            return;
        }

        this.emit('serverbound', des.data, des)
        if (des.canceled) return

        if (!this.upstream) {
            this.pendingUpstreamPackets.push({ data: des.data, packet, modified: des.modified })
            return
        }

        this.forwardToUpstream(des.data, packet, des.modified)
    }

    close(reason) {
        super.close(reason)
        this.upstream?.close(reason)
        this.chunkSendCache = []
    }
}

class Relay extends Server {
    /**
     * Creates a new non-transparent proxy connection to a destination server
     * @param {Options} options
     */
    constructor(options) {
        super(options)
        this.RelayPlayer = options.relayPlayer || RelayPlayer
        this.forceSingle = options.forceSingle
        this.upstreams = new Map()
        this.conLog = console.log
        this.enableChunkCaching = options.enableChunkCaching
    }

    async openUpstreamConnection(ds, clientAddr) {
        const options = {
            authTitle: this.options.authTitle,
            flow: this.options.flow,
            deviceType: this.options.deviceType,
            username: ds.profile?.name || undefined,
            version: this.options.version,
            host: this.options.destination.host,
            port: this.options.destination.port,
            transport: this.options.destination.transport,
            networkId: this.options.destination.networkId,
            authflow: this.options.authflow,
            protocolVersion: this.options.protocolVersion,
            onMsaCode: (code) => {
                if (this.options.onMsaCode) {
                    this.options.onMsaCode(code, ds)
                } else {
                    ds.disconnect("It's your first time joining. Please sign in and reconnect to join this server:\n\n" + code.message)
                }
            },
            profilesFolder: this.options.profilesFolder,
            autoInitPlayer: false,
            delayedInit: true,
            skinData: {
                ...ds.skinData,
                ...this.options.skinData
            }
        }

        const client = new Client(options)

        await client.init();
        client.connect()

        client.once('resource_packs_info', (params) => {
            client.write('client_cache_status', { enabled: false })

            ds.upstream = client

            console.log('Connected to upstream server')

            const data = { name: 'resource_packs_info', params }
            ds.emit('clientbound', data, { canceled: false })
            ds.write('resource_packs_info', params)

            const len = ds.pendingUpstreamPackets.length
            if (len > 0) {
                for (let i = 0; i < len; i++) {
                    const pending = ds.pendingUpstreamPackets[i]
                    ds.forwardToUpstream(pending.data, pending.packet, pending.modified)
                }

                ds.pendingUpstreamPackets = [];
            }

            client.readPacket = (packet) => ds.readUpstream(packet)

            this.emit('join', ds, client)
        })

        client.on('error', (err) => {
            console.log(err, "upstream client")

            ds.disconnect('Server error: ' + err.message)

            this.upstreams.delete(clientAddr.hash)
        })

        client.on('close', (reason) => {
            const cascading = ds.status === undefined || ds.status === 0 /* Disconnected */

            console.log('>>> upstream Client emitted CLOSE for', clientAddr, '— reason:', reason, cascading ? '(cascading from local close — ds.disconnect will no-op)' : '(upstream-initiated)')

            ds.disconnect(reason ? `Backend server closed connection (${reason})` : 'Backend server closed connection')

            this.upstreams.delete(clientAddr.hash)
        })

        this.upstreams.set(clientAddr.hash, client)
    }

    closeUpstreamConnection(clientAddr) {
        const up = this.upstreams.get(clientAddr.hash)
        if (!up) throw Error(`unable to close non-open connection ${clientAddr.hash}`)
        up.close()

        this.upstreams.delete(clientAddr.hash)
    }

    onOpenConnection = (conn) => {
        this.clientCount++

        const player = new this.RelayPlayer(this, conn)
        this.clients[conn.address] = player

        this.emit('connect', player)

        player.on('login', () => {
            console.log('Received login from', conn.address)
            this.openUpstreamConnection(player, conn.address)
        })

        player.on('close', (reason) => {
            console.log('player disconnected', conn.address, reason)
            this.clientCount--
            delete this.clients[conn.address]
        })
    }

    close(...a) {
        for (const [, v] of this.upstreams) {
            v.close(...a)
        }

        super.close(...a)
    }
}

module.exports = { Relay }