const { ClientStatus, Connection } = require('./connection')

const JWT = require('jsonwebtoken')
const crypto = require('crypto')

const curve = 'secp384r1'
const pem = { format: 'pem', type: 'sec1' }
const der = { format: 'der', type: 'spki' }

class Player extends Connection {
    constructor(server, connection) {
        super()
        this.server = server
        this.features = server.features
        this.serializer = server.serializer
        this.deserializer = server.deserializer
        this.connection = connection
        this.options = server.options

        this.status = ClientStatus.Authenticating

        this.batchHeader = this.server.batchHeader
        this.disableEncryption = this.server.disableEncryption

        // Compression is server-wide
        this.compressionAlgorithm = this.server.compressionAlgorithm
        this.compressionLevel = this.server.compressionLevel
        this.compressionThreshold = this.server.compressionThreshold
        this.compressionHeader = this.server.compressionHeader

        this._sentNetworkSettings = true // 1.19.30+

        this.ecdhKeyPair = crypto.generateKeyPairSync('ec', { namedCurve: curve })
        this.publicKeyDER = this.ecdhKeyPair.publicKey.export(der)
        this.privateKeyPEM = this.ecdhKeyPair.privateKey.export(pem)
        this.clientX509 = this.publicKeyDER.toString('base64')
    }

    getUserData() {
        return this.userData
    }

    sendNetworkSettings() {
        this.batch.updateCompressionSettings(this)

        this.write('network_settings', {
            compression_threshold: this.server.compressionThreshold,
            compression_algorithm: this.server.compressionAlgorithm,
            client_throttle: false,
            client_throttle_threshold: 0,
            client_throttle_scalar: 0
        })

        this._sentNetworkSettings = true
        this.compressionReady = true
        
        this.batch.updateCompressionSettings(this)
    }

    onLogin(packet) {
        const body = packet.data
        this.emit('loggingIn', body)

        const clientVer = body.params.protocol_version

        const tokens = body.params.tokens
        const decode = (data) => data.split('.').map(k => Buffer.from(k, 'base64'))

        let [sh, skinData] = decode(String(tokens.client))
        const skinHeader = JSON.parse(String(sh))
        skinData = JSON.parse(String(skinData))

        const identity = JSON.parse(String(tokens.identity))
        const Token = identity.Token || ''

        let [h, tokenData] = decode(String(Token))
        tokenData = JSON.parse(String(tokenData))
        h = JSON.parse(String(h))

        if (!skinHeader?.x5u) throw new Error('Login token is missing x5u header — cannot derive shared secret')

        const publicKey = crypto.createPublicKey({
            key: Buffer.from(skinHeader.x5u, 'base64'),
            format: 'der',
            type: 'spki'
        })

        const salt = crypto.randomBytes(16)

        this.secretKeyBytes = crypto.createHash('sha256').update(salt).update(crypto.diffieHellman({ privateKey: this.ecdhKeyPair.privateKey, publicKey })).digest()

        const token = JWT.sign({ salt: salt.toString('base64') }, this.ecdhKeyPair.privateKey, { algorithm: 'ES384', header: { x5u: this.clientX509 } })

        this.write('server_to_client_handshake', { token })

        const initial = this.secretKeyBytes.slice(0, 16)
        this.startEncryption(initial)

        this.userData = tokenData
        this.skinData = skinData
        this.version = clientVer

        this.emit('login', { user: this.userData }) // emit events for user
    }

    /**
     * Disconnects a client before it has joined
     * @param {string} playStatus
     */
    sendDisconnectStatus(playStatus) {
        if (this.status === ClientStatus.Disconnected) return
        this.write('play_status', { status: playStatus })
        this.close('kick')
    }

    /**
     * Disconnects a client
     */
    disconnect(reason = 'Server closed', hide = false) {
        if (this.status === ClientStatus.Disconnected || this._disconnecting) return

        this._disconnecting = true
        console.log('>>> disconnect() ENTRY for', this.connection?.address, '— reason:', reason, '— status:', this.status, new Error('disconnect stack').stack)

        try {
            this.write('disconnect', {
                hide_disconnect_screen: hide,
                message: reason,
                filtered_message: ''
            })
        } catch (e) {
            console.log('disconnect: write("disconnect") threw:', e.message)
        }

        setTimeout(() => {
            console.log('>>> disconnect() setTimeout firing close("kick") for', this.connection?.address)
            this.close('kick')
        }, 100)
    }

    close(reason) {
        console.log('>>> Player.close() ENTRY for', this.connection?.address, '— reason:', reason, '— status:', this.status, new Error('Player.close stack').stack)
        if (this.status !== ClientStatus.Disconnected) {
            this.emit('close') // Emit close once
            if (!reason) console.log('Client closed connection', this.connection?.address)
        }
        this.connection?.close()
        this.removeAllListeners()
        this.status = ClientStatus.Disconnected
    }

    // After sending Server to Client Handshake, this handles the client's
    // Client to Server handshake response. This indicates successful encryption
    onHandshake() {
        // https://wiki.vg/Bedrock_Protocol#Play_Status
        this.write('play_status', { status: 'login_success' })
        this.status = ClientStatus.Initializing
        this.emit('join')
    }

    readPacket(packet) {
        try {
            var des = this.server.deserializer.parsePacketBuffer(packet) // eslint-disable-line
        } catch (e) {
            this.disconnect('Server error')
            console.log('Dropping packet from', this.connection.address, e)
            return
        }

        switch (des.data.name) {
            // This is the first packet on 1.19.30 & above
            case 'request_network_settings':
                this.sendNetworkSettings()
                this.compressionLevel = this.server.compressionLevel
                return
            // Below 1.19.30, this is the first packet.
            case 'login':
                this.onLogin(des)
                if (!this._sentNetworkSettings) this.sendNetworkSettings()
                return
            case 'client_to_server_handshake':
                this.onHandshake()
                break
            case 'set_local_player_as_initialized':
                this.status = ClientStatus.Initialized    
                this.emit('spawn')
                break
        }

        this.emit(des.data.name, des.data.params)
    }
}

module.exports = { Player }