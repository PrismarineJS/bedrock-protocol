const { ClientStatus, Connection } = require('./connection')
const { createDeserializer, createSerializer, PROTOCOL_VERSION, GAME_VERSION } = require('./transforms/serializer')
const { NethernetClient } = require('./nethernet')
const { RakClient } = require('./rak')
const { authenticate } = require('./client/auth')
const { NethernetSignal } = require('./websocket/signal')
const { NethernetJSONRPC } = require('./websocket/signal-jsonrpc')

const JWT = require('jsonwebtoken')
const crypto = require('crypto')

const steve = require("./skins/steve.json");

const { v3, v4, NIL } = require('uuid')

const pem = { format: 'pem', type: 'sec1' }
const der = { format: 'der', type: 'spki' }

class Client extends Connection {
    connection

    constructor(options) {
        super()
        this.options = { ...options }
        this.compressionAlgorithm = 'none'
        this.compressionThreshold = 512
        this.compressionLevel = options.compressionLevel

        if (this.options.transport.includes('NETHERNET')) this.nethernet = {}

        if (!options.delayedInit) this.init()
    }

    async init() {
        this.serializer = createSerializer()
        this.deserializer = createDeserializer()
        this.features = { compressorInHeader: true }

        // There is exactly one bundled schema (see transforms/serializer.js), so the
        // protocol/game version we declare to the server MUST match what we actually
        // encode with, or packets get decoded with the wrong shape and the server
        // kicks us as malformed (e.g. packet id 144, player_auth_input). Warn and
        // override rather than silently trusting a possibly-stale config value.
        if (this.options.protocolVersion != null && this.options.protocolVersion !== PROTOCOL_VERSION) {
            console.warn(`[bedrockx] options.protocolVersion (${this.options.protocolVersion}) does not match the bundled schema's protocol (${PROTOCOL_VERSION}, game version ${GAME_VERSION}); overriding to ${PROTOCOL_VERSION} so encoded packets match what's declared to the server.`)
        }
        this.options.protocolVersion = PROTOCOL_VERSION
        if (this.options.version == null) this.options.version = GAME_VERSION

        this.ecdhKeyPair = crypto.generateKeyPairSync('ec', { namedCurve: "secp384r1" })
        this.clientX509 = this.ecdhKeyPair.publicKey.export(der).toString('base64')
        this.privateKeyPEM = this.ecdhKeyPair.privateKey.export(pem)

        await authenticate(this, this.options)

        switch (this.options.transport) {
            case "NETHERNET":
            case "NETHERNET_JSONRPC":
                this.connection = new NethernetClient({ networkId: this.options.networkId, token: this.token, privateKey: this.ecdhKeyPair.privateKey })

                this.batchHeader = null
                this.disableEncryption = true

                this.nethernet.signalling = this.options.transport === "NETHERNET_JSONRPC" ? new NethernetJSONRPC(this.connection.nethernet.networkId, this.options.authflow, this.options.version, this.options.networkId) : new NethernetSignal(this.connection.nethernet.networkId, this.options.authflow, this.options.version, this.options.networkId)

                await this.nethernet.signalling.connect()

                this.connection.nethernet.credentials = this.nethernet.signalling.credentials
                this.connection.nethernet.signalHandler = this.nethernet.signalling.write.bind(this.nethernet.signalling)

                this.nethernet.signalling.on('signal', signal => this.connection.nethernet.handleSignal(signal))
                break;
            case "DEFAULT":
                this.connection = new RakClient({ host: this.options.host, port: this.options.port })

                this.batchHeader = 0xfe
                this.disableEncryption = false
                break;
        }

        this.batch.updateCompressionSettings(this)

        this.emit('connect_allowed')
    }

    connect() {
        if (!this.connection) throw new Error('Connect not currently allowed')
        this._connect()
    }

    onEncapsulated = (encapsulated) => {
        this.handle(Buffer.from(encapsulated.buffer))
    }

    _connect = async () => {
        this.connection.onConnected = () => {
            this.status = ClientStatus.Connecting
            this.write('request_network_settings', { client_protocol: this.options.protocolVersion })
        }

        this.connection.onCloseConnection = (reason) => {
            this.close(reason)
        }

        this.connection.onEncapsulated = this.onEncapsulated
        this.connection.connect()
    }

    sendLogin() {
        this.status = ClientStatus.Authenticating

        let payload = {
            GameVersion: this.options.version,
            PersonaSkin: true,
            DeviceOS: 2,
            DeviceId: v3(v4(), NIL).replace(/-/g, '').toUpperCase(),
            DeviceModel: 'iPhone14,3',
            CurrentInputMode: 2,
            DefaultInputMode: 2,
            SelfSignedId: v3(v4(), NIL),
            GUIScale: 0,
            UIProfile: 1,
            LanguageCode: 'en_US',
            MaxViewDistance: 12,
            MemoryTier: 4,
            PlatformType: 1,
            GraphicsMode: 1,
            TrustedSkin: true,
            OverrideSkin: false,
            ...steve,
            ...this.options.skinData
        }

        const PlayFabId = this.tokenData.mid.toLowerCase() || "";

        const updPFID = (data) => btoa(atob(data).replaceAll(`aed7e8a4d485a49a-5`, `${PlayFabId}-5`));
        payload.SkinId = `persona-${PlayFabId || ""}-5`;
        payload.SkinGeometryData = updPFID(payload.SkinGeometryData);
        payload.SkinResourcePatch = updPFID(payload.SkinResourcePatch);

        this.write('login', {
            protocol_version: this.options.protocolVersion,
            tokens: {
                identity: JSON.stringify({ AuthenticationType: 0, Certificate: JSON.stringify({ chain: [] }), Token: this.token }),
                client: JWT.sign(payload, this.ecdhKeyPair.privateKey, { algorithm: 'ES384', header: { x5u: this.clientX509 } })
            }
        })
    }

    disconnect(reason = 'Client leaving') {
        if (this.status === ClientStatus.Disconnected) return

        this.close(reason)
    }

    close(reason) {
        if (this.status === ClientStatus.Disconnected) return // Already closed, ignore duplicate close (e.g. a queued disconnect packet arriving after the connection already dropped)
        this.emit('close', reason) // Emit close once
        this.batch = null;
        this.connection?.close()
        this.removeAllListeners()
        this.status = ClientStatus.Disconnected
        if (!this.options.transport.includes("NETHERNET")) return
        if (this.nethernet?.signalling) this.nethernet.signalling.destroy()
        this.nethernet = null
    }

    readPacket(packet) {
        try {
            var des = this.deserializer.parsePacketBuffer(packet) // eslint-disable-line
        } catch (e) {
            this.emit('error', e)
            return
        }

        // Abstract some boilerplate before sending to listeners
        switch (des.data.name) {
            case 'network_settings':
                this.compressionAlgorithm = des.data.params.compression_algorithm || 'deflate'
                this.compressionThreshold = des.data.params.compression_threshold
                this.compressionReady = true
                this.batch.updateCompressionSettings(this)

                this.sendLogin()
                break
            case 'server_to_client_handshake':
                const [header, payload] = des.data.params.token.split('.', 2).map(part => JSON.parse(Buffer.from(part, 'base64url').toString()))

                if (!this.disableEncryption) {
                    this.secretKeyBytes = crypto.createHash('sha256').update(Buffer.from(payload.salt, 'base64')).update(crypto.diffieHellman({ privateKey: this.ecdhKeyPair.privateKey, publicKey: crypto.createPublicKey({ key: Buffer.from(header.x5u, 'base64'), ...der }) })).digest()
                    this.startEncryption(this.secretKeyBytes.slice(0, 16))
                }

                this.write('client_to_server_handshake', {})
                this.status = ClientStatus.Initializing
                break
            case 'disconnect': // Client kicked
                this.emit('kick', des.data.params)
                this.close()
                break
            case 'item_registry':
                des.data.params.itemstates?.forEach(state => {
                    if (state.name === 'minecraft:shield') {
                        this.serializer.proto.setVariable('ShieldItemID', state.runtime_id)
                        this.deserializer.proto.setVariable('ShieldItemID', state.runtime_id)
                    }
                })
                break
            case 'play_status':
                if (this.status === ClientStatus.Authenticating) this.status = ClientStatus.Initializing
                break
            default:
                break
        }

        this.emit(des.data.name, des.data.params)
    }
}

module.exports = { Client }