import EventEmitter from 'events'
import { Realm } from 'prismarine-realms'
import { ServerDeviceCodeResponse } from 'prismarine-auth'

declare module 'bedrock-protocol' {
  type Version = '1.21.93' | '1.21.90' | '1.21.80' | '1.21.70' | '1.21.60' | '1.21.50' | '1.21.42' | '1.21.30' | '1.21.2' | '1.21.0' | '1.20.80' | '1.20.71' | '1.20.61' | '1.20.50' | '1.20.40' | '1.20.30' | '1.20.10' | '1.20.0' | '1.19.80' | '1.19.70' | '1.19.63' | '1.19.62' | '1.19.60' | '1.19.51' | '1.19.50' | '1.19.41' | '1.19.40' | '1.19.31' | '1.19.30' | '1.19.22' | '1.19.21' | '1.19.20' | '1.19.11' | '1.19.10' | '1.19.2' | '1.19.1' | '1.18.31' | '1.18.30' | '1.18.12' | '1.18.11' | '1.18.10' | '1.18.2' | '1.18.1' | '1.18.0' | '1.17.41' | '1.17.40' | '1.17.34' | '1.17.30' | '1.17.11' | '1.17.10' | '1.17.0' | '1.16.220' | '1.16.210' | '1.16.201'

  export interface Options {
    // The string version to start the client or server as
    version?: Version
    // For the client, the host of the server to connect to (default: 127.0.0.1)
    // For the server, the host to bind to (default: 0.0.0.0)
    host: string
    // The port to connect or bind to, default: 19132
    port: number
    // For the client, if we should login with Microsoft/Xbox Live.
    // For the server, if we should verify client's authentication with Xbox Live.
    offline?: boolean

    // Which raknet backend to use
    raknetBackend?: 'jsp-raknet' | 'raknet-native' | 'raknet-node'
    // If using JS implementation of RakNet, should we use workers? (This only affects the client)
    useRaknetWorker?: boolean
    // Compression level for zlib, default to 7
    compressionLevel?: number
    // How frequently the packet queue should be flushed in milliseconds, defaults to 20ms
    batchingInterval?: number
  }

  export interface ClientOptions extends Options {
    // The username to connect to the server as
    username: string
    // The view distance in chunks
    viewDistance?: number
    // Specifies which game edition to sign in as. Optional, but some servers verify this.
    authTitle?: string
    // How long to wait in milliseconds while trying to connect to the server.
    connectTimeout?: number
    // whether to skip initial ping and immediately connect
    skipPing?: boolean
    // Update the options' port parameter to match the port broadcast on the server's ping data (default to true if `realms` not specified)
    followPort?: boolean
    // where to log connection information to (default to console.log)
    conLog?: any
    // used to join a Realm instead of supplying a host/port
    realms?: RealmsOptions
    // the path to store authentication caches, defaults to .minecraft
    profilesFolder?: string | false
    // Called when microsoft authorization is needed when not provided it will the information log to the console instead
    onMsaCode?: (data: ServerDeviceCodeResponse) => void
  }

  export interface ServerOptions extends Options {
    // The maximum number of players allowed on the server at any time.
    maxPlayers?: number
    motd?: {
      // The header for the MOTD shown in the server list.
      motd: string
      // The sub-header for the MOTD shown in the server list.
      levelName?: string
    }
    advertisementFn?: () => ServerAdvertisement
  }

  enum ClientStatus {
    Disconnected,
    Authenticating,
    Initializing,
    Initialized
  }

  export class Connection extends EventEmitter {
    readonly status: ClientStatus

    // Check if the passed version is less than or greater than the current connected client version.
    versionLessThan(version: string | number): boolean
    versionGreaterThan(version: string | number): boolean
    versionGreaterThanOrEqualTo(version: string | number): boolean

    // Writes a Minecraft bedrock packet and sends it without queue batching
    write(name: string, params: object): void
    // Adds a Minecraft bedrock packet to be sent in the next outgoing batch
    queue(name: string, params: object): void
    // Writes a MCPE buffer to the connection and skips Protodef serialization. `immediate` if skip queue.
    sendBuffer(buffer: Buffer, immediate?: boolean): void
  }

  type PlayStatus =
    | 'login_success'
    // # Displays "Could not connect: Outdated client!"
    | 'failed_client'
    // # Displays "Could not connect: Outdated server!"
    | 'failed_spawn'
    // # Sent after world data to spawn the player
    | 'player_spawn'
    // # Displays "Unable to connect to world. Your school does not have access to this server."
    | 'failed_invalid_tenant'
    // # Displays "The server is not running Minecraft: Education Edition. Failed to connect."
    | 'failed_vanilla_edu'
    // # Displays "The server is running an incompatible edition of Minecraft. Failed to connect."
    | 'failed_edu_vanilla'
    // # Displays "Wow this server is popular! Check back later to see if space opens up. Server Full"
    | 'failed_server_full'

  export class Client extends Connection {
    constructor(options: Options)
    // The client's EntityID returned by the server
    readonly entityId: BigInt

    /**
     * Close the connection, leave the server.
     */
    close(reason?: string): void

    /**
     * Send a disconnect packet and close the connection
     */
    disconnect(): void
  }

  /**
   * `Player` represents a player connected to the server.
   */
  export class Player extends Connection {
    profile?: {
      xuid: string
      uuid: string
      name: string
    }
    version: string

    getUserData(): object

    /**
     * Disconnects a client before it has logged in via a PlayStatus packet.
     * @param {string} playStatus
     */
    sendDisconnectStatus(playStatus: PlayStatus): void

    /**
     * Disconnects a client
     * @param reason The message to be shown to the user on disconnect
     * @param hide Don't show the client the reason for the disconnect
     */
    disconnect(reason: string, hide?: boolean): void

    /**
     * Close the connection. Already called by disconnect. Call this to manually close RakNet connection.
     */
    close(): void

    on(event: 'login', cb: () => void): any
    on(event: 'join', cb: () => void): any
    on(event: 'close', cb: (reason: string) => void): any
    on(event: 'packet', cb: (packet: object) => void): any
    on(event: 'spawn', cb: (reason: string) => void): any
  }

  export class Server extends EventEmitter {
    clients: Map<string, Player>
    conLog: Function

    constructor(options: Options)

    listen(): Promise<void>
    close(disconnectReason?: string): Promise<void>

    on(event: 'connect', cb: (client: Player) => void): any
  }

  type RelayOptions = Options & {
    // Toggle packet logging.
    logging?: boolean
    // Skip authentication for connecting clients?
    offline?: false
    // Specifies which game edition to sign in as to the destination server. Optional, but some servers verify this.
    authTitle?: string
    // Where to proxy requests to.
    destination: {
      realms?: RealmsOptions
      host: string
      port: number
      // Skip authentication connecting to the remote server?
      offline?: boolean
    }
    // Whether to enable chunk caching (default: false)
    enableChunkCaching?: boolean

    // Only allow one client to connect at a time (default: false)
    forceSingle?: boolean

    // Do not disconnect clients on server packet parsing errors and drop the packet instead (default: false)
    omitParseErrors?: boolean

    // Dispatched when a new client has logged in, and we need authentication
    // tokens to join the backend server. Cached after the first login.
    // If this is not specified, the client will be disconnected with a login prompt.
    onMsaCode?(data: ServerDeviceCodeResponse, client: Client): any
    // prismarine-auth configuration
    flow?: string,
    deviceType?: string
  }

  export class Relay extends Server {
    constructor(options: RelayOptions)
  }

  export class ServerAdvertisement {
    motd: string
    name: string
    protocol: number
    version: string
    playersOnline: number
    playersMax: number
    serverId: string
    levelName: string
    gamemodeId: number
    portV4: number
    portV6: number

    constructor(obj: object, port: number, version: string)
  }

  export interface RealmsOptions {
    realmId?: string
    realmInvite?: string
    pickRealm?: (realms: Realm[]) => Realm
  }

  export function createClient(options: ClientOptions): Client
  export function createServer(options: ServerOptions): Server

  export function ping({
    host,
    port
  }: {
    host: string
    port: number
  }): Promise<ServerAdvertisement>
}
