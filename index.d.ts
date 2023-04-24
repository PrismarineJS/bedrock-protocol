import { ServerDeviceCodeResponse } from "prismarine-auth";
import { RealmPlayer } from "prismarine-realms";
import { EventEmitter } from "node:events";

declare module "bedrock-protocol" {
  type Version =
    | "1.19.70"
    | "1.19.63"
    | "1.19.62"
    | "1.19.60"
    | "1.19.51"
    | "1.19.50"
    | "1.19.41"
    | "1.19.40"
    | "1.19.31"
    | "1.19.30"
    | "1.19.22"
    | "1.19.21"
    | "1.19.20"
    | "1.19.11"
    | "1.19.10"
    | "1.19.2"
    | "1.19.1"
    | "1.18.31"
    | "1.18.30"
    | "1.18.12"
    | "1.18.11"
    | "1.18.10"
    | "1.18.2"
    | "1.18.1"
    | "1.18.0"
    | "1.17.41"
    | "1.17.40"
    | "1.17.34"
    | "1.17.30"
    | "1.17.11"
    | "1.17.10"
    | "1.17.0"
    | "1.16.220"
    | "1.16.210"
    | "1.16.201";

  enum title {
    MinecraftNintendoSwitch,
    MinecraftJava,
  }

  export enum ClientStatus {
    Disconnected, // typo here
    Authenticating,
    Initializing,
    Initialized,
  }

  type PlayStatus =
    | "login_success"
    | "failed_client"
    | "failed_spawn"
    | "player_spawn"
    | "failed_invalid_tenant"
    | "failed_vanilla_edu"
    | "failed_edu_vanilla"
    | "failed_server_full";
  interface Options {
    host: string;
    port?: number;
    version?: Version; // using type Version
    offline?: boolean;
    raknetBackend?: "jsp-raknet" | "raknet-native" | "raknet-node";
    useRaknetWorker?: boolean;
    compressionLevel?: number;
    batchingInterval?: number;
  }

  export interface ClientOptions extends Options {
    username: string;
    viewDistance?: number;
    authTitle?: title | string;
    connectTimeout?: number;
    skipPing?: boolean;
    followPort?: boolean;
    conLog?: any;
    realms?: RealmPlayer;
    profilesFolder?: string | false;
    onMsaCode?: (data: ServerDeviceCodeResponse) => void;
  }

  export interface ServerOptions extends Options {
    maxPlayers?: number; // optional here
    motd: {
      motd: string;
      levelName: string;
    };
    advertisementFn?: () => ServerAdvertisement; // optional here
  }

  export class Connection extends EventEmitter {
    #status: ClientStatus.Disconnected;
    sendQ: [];
    sendIds: any[];

    get status(): ClientStatus;
    set status(val: ClientStatus);

    public versionLessThan(protocolVersion: number): boolean;
    public versionGreaterThan(protocolVersion: number): boolean;
    public versionGreaterThanOrEqualTo(protocolVersion: number): boolean;

    private startEncryption(iv: Uint8Array): void;
    private startServerboundEncryption(token: object): void;
    private toBase64(string: string): string;

    public write(name: string, params: object): void;
    public queue(name: string, params: object): void;
    public sendBuffer(buffer: Buffer): void;
  }

  export class Client extends Connection {
    public options: ClientOptions;
    readonly entityId: BigInt;

    constructor(options: ClientOptions);

    disconnect(reason: string): void;
    close(): void;
  }

  export class Player extends Connection {
    profile: {
      name: string;
      uuid: string;
      xuid: string;
    };
    userData: object;
    skinData: object;

    sendDisconnectStatus(playStatus: PlayStatus): void;
    disconnect(reason: string, hide?: boolean): void;
    close(): void;

    getUserData(): object;

    on(event: "login", cb: () => void): any;
    on(event: "join", cb: () => void): any;
    on(event: "close", cb: (reason: string) => void): any;
    on(event: "spawn", cb: (reason: string) => void): any;
    on(event: "packet", cb: (reason: string) => void): any;
  }

  type Clients<T extends Player> = Record<string, T>;

  export class Server extends EventEmitter {
    clients: Clients<Player>;
    conLog: () => void; // here

    constructor(options: ServerOptions);

    listen(host?: string, port?: number): void;
    close(disconnectReason: string): void;

    on(event: "connect", cb: (client: Player) => void): any;
  }

  export class ServerAdvertisement {
    motd: string;
    levelName: string;
    playersOnline: number;
    playersMax: number;
    gamemode: string;
    serverId: string;
    gamemodeId: number;
    portV4: number;
    portV6: number;
    version: string;
    protocol: string;

    constructor(obj: object, port: number, version: string);

    toBuffer(version: string): Buffer;
    toString(): string;
    fromString(str: string): ServerAdvertisement;
  }

  export function createClient(options: ClientOptions): Client;
  export function createServer(options: ServerOptions): Server;

  export function ping({
    host,
    port,
  }: {
    host: string;
    port: number;
  }): Promise<ServerAdvertisement>;
}
