import EventEmitter from "events"
import { Realm } from "prismarine-realms"

declare module "bedrock-protocol" {
  type Version = '1.19.50' | '1.19.41 | 1.19.40' | '1.19.31' | '1.19.30' | '1.19.22' | '1.19.21' | '1.19.20' | '1.19.11' | '1.19.10' | '1.19.2' | '1.19.1' | '1.18.31' | '1.18.30' | '1.18.12' | '1.18.11' | '1.18.10' | '1.18.2' | '1.18.1' | '1.18.0' | '1.17.41' | '1.17.40' | '1.17.34' | '1.17.30' | '1.17.11' | '1.17.10' | '1.17.0' | '1.16.220' | '1.16.210' | '1.16.201'

  enum title { MinecraftNintendoSwitch, MinecraftJava }

  export interface Options {
    // The string version to start the client or server as
    version?: string
    // For the client, the host of the server to connect to (default: 127.0.0.1)
    // For the server, the host to bind to (default: 0.0.0.0)
    host: string
    // The port to connect or bind to, default: 19132
    port?: number
    // For the client, if we should login with Microsoft/Xbox Live.
    // For the server, if we should verify client's authentication with Xbox Live.
    offline?: boolean,

    // Whether or not to use C++ version of RakNet
    useNativeRaknet?: boolean,
    // If using JS implementation of RakNet, should we use workers? (This only affects the client)
    useRaknetWorker?: boolean
    // Compression level for zlib, default to 7
    compressionLevel?: number
    // How frequently the packet queue should be flushed in milliseconds, defaults to 20ms
    batchingInterval?: number
  }

  export interface ClientOptions extends Options {
    // The username to connect to the server as
    username: string,
    // The view distance in chunks
    viewDistance?: number,
    // Specifies which game edition to sign in as. Optional, but some servers verify this.
    authTitle?: title | string,
    // How long to wait in milliseconds while trying to connect to the server.
    connectTimeout?: number
    // whether to skip initial ping and immediately connect
    skipPing?: boolean
    // Update the options' port parameter to match the port broadcast on the server's ping data (default to true if `realms` not specified)
    followPort?: boolean
    // where to log connection information to (default to console.log)
    conLog?
    // used to join a Realm instead of supplying a host/port
    realms?: RealmsOptions
  }

  export interface ServerOptions extends Options {
    // The maximum number of players allowed on the server at any time.
    maxPlayers: number
    motd: {
      // The header for the MOTD shown in the server list.
      motd: string,
      // The sub-header for the MOTD shown in the server list.
      levelName: string
    }
    advertisementFn: () => ServerAdvertisement
  }

  enum ClientStatus {
    Disconected, Authenticating, Initializing, Initialized
  }

  export class Connection extends EventEmitter {
    readonly status: ClientStatus

    // Check if the passed version is less than or greater than the current connected client version.
    versionLessThan(version: string | number)
    versionGreaterThan(version: string | number)

    // Writes a Minecraft bedrock packet and sends it without queue batching
    write(name: string, params: object)
    // Adds a Minecraft bedrock packet to be sent in the next outgoing batch
    queue(name: string, params: object)
    // Writes a MCPE buffer to the connection and skips Protodef serialization. `immediate` if skip queue.
    sendBuffer(buffer: Buffer, immediate?: boolean)
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
    close()

    /**
     * Send a disconnect packet and close the connection
     */
    disconnect()
  }

  /**
   * `Player` represents a player connected to the server. 
   */
  export class Player extends Connection {
    /**
     * Disconnects a client before it has logged in via a PlayStatus packet.
     * @param {string} playStatus
     */
    sendDisconnectStatus(playStatus: PlayStatus)

    /**
     * Disconnects a client
     * @param reason The message to be shown to the user on disconnect
     * @param hide Don't show the client the reason for the disconnect
     */
    disconnect(reason: string, hide?: boolean)

    /**
     * Close the connection. Already called by disconnect. Call this to manually close RakNet connection. 
     */
    close()

    on(event: 'login', cb: () => void)
    on(event: 'join', cb: () => void)
    on(event: 'close', cb: (reason: string) => void)
  }

  export class Server extends EventEmitter {
    clients: Map<string, Player>
    // Connection logging function
    conLog: Function
    constructor(options: Options)
    // Disconnects all currently connected clients
    close(disconnectReason: string)
  }

  type RelayOptions = Options & {
    host: string,
    port: number,
    // Toggle packet logging.
    logging: boolean,
    // Skip authentication for connecting clients?
    offline: false,
    // Specifies which game edition to sign in as to the destination server. Optional, but some servers verify this.
    authTitle: title | string
    // Where to proxy requests to.
    destination: {
      realms?: RealmsOptions
      host: string,
      port: number,
      // Skip authentication connecting to the remote server?
      offline: false,
    }
    // Whether to enable chunk caching (default: false)
    enableChunkCaching?: boolean

    // Only allow one client to connect at a time (default: false)
    forceSinge: boolean

    // Dispatched when a new client has logged in, and we need authentication
    // tokens to join the backend server. Cached after the first login.
    // If this is not specified, the client will be disconnected with a login prompt.
    onMsaCode(data, client)
  }

  export class Relay extends Server {
    constructor(options: RelayOptions)
  }

  class ServerAdvertisement {
    motd: string
    name: string
    protocol: number
    version: string
    playersOnline: number
    playersMax: number
    gamemode: string
    serverId: string
    levelName:string
  }

  export interface RealmsOptions {
    realmId?: string
    realmInvite?: string 
    pickRealm?: (realms: Realm[]) => Realm
  }

  export function createClient(options: ClientOptions): Client
  export function createServer(options: ServerOptions): Server

  export function ping({ host, port }: { host: string, port: number }): Promise<ServerAdvertisement>
}
