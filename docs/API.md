# Documentation

## be.createClient(options) : Client

Returns a `Client` instance and connects to the server.

`options` is an object containing the properties :

| Parameter   | Optionality | Description |
| ----------- | ----------- |-|
| host        | Conditional | Not required if `realms` is set. host to connect to, for example `127.0.0.1`. |
| port        | *optional* |  port to connect to, default to **19132**     |
| version     | *optional* |  Explicit version override. Otherwise select a minecraft-data version matching the protocol number in the server pong, regardless of its displayed game version. Report an error if that protocol is unsupported. Fall back to `CURRENT_VERSION` in `src/options.js` only if discovery fails, is skipped, or provides no protocol number. |
| offline     | *optional* |  default to **false**. Set this to true to disable Microsoft/Xbox auth.   |
| username    | Required | The profile name to connect to the server as. If `offline` set to true, the username that will appear on join, that would normally be the Xbox Gamer Tag. |
| connectTimeout | *optional* | Transport establishment deadline after authentication and signalling, default **9000ms**. Does not bound login or spawning. |
| pingTimeout | *optional* | Advertisement lookup deadline: **1000ms** for RakNet, **10000ms** for Nethernet. Used by `createClient` and `client.ping()`. |
| onMsaCode   | *optional* |  Callback called when signing in with a microsoft account with device code auth, `data` is an object documented [here](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-device-code#device-authorization-response) |
| profilesFolder | *optional* | Where to store cached authentication tokens. Defaults to .minecraft, or the node_modules folder if not found. |
| skipPing | *optional* | Skip the initial version-discovery ping. Nethernet `'services'` mode always skips this LAN probe; specify `version` or use the fallback in `src/options.js`. |
| followPort | *optional* | Update the options' port parameter to match the port broadcast on the server's ping data (default to true if `realms` not specified) |
| autoInitPlayer | *optional* |  default to true, If we should send SetPlayerInitialized to the server after getting play_status spawn.    |
| conLog | *optional* | Where to log connection information (server join, kick messages to). Defaults to console.log, set to `null` to not log anywhere. |
| useRaknetWorkers | *optional* | Use workers with the `jsp-raknet` client backend (default **true**). |
| raknetBackend | *optional* | Specifies the raknet implementation to use. Possible options are 'raknet-native' (default, original C++ implementation), 'jsp-raknet' (JS port), and 'raknet-node' (Rust port). Please note when using the non-JS implementation you may the need approporate build tools on your system (for example a C++ or Rust compiler). |
| compressionLevel | *optional* | What zlib compression level to use, default to **7** |
| batchingInterval | *optional* | How frequently, in milliseconds to flush and write the packet queue (default: 20ms) |
| realms | *optional* | An object which should contain one of the following properties: `realmId`, `realmInvite`, `pickRealm`. When defined will attempt to join a Realm without needing to specify host/port. **The authenticated account must either own the Realm or have been invited to it** |
| realms.realmId | *optional* | The id of the Realm to join. |
| realms.realmInvite | *optional* | The invite link/code of the Realm to join. |
| realms.pickRealm | *optional* | A function which will have an array of the user Realms (joined/owned) passed to it. The function should return a Realm. |

*`useNativeRaknet` is deprecated. Setting to true will use 'raknet-native' for `raknetBackend` and setting it to false will use a JavaScript implemenation (jsp-raknet)*

The following special events are emitted by the client on top of protocol packets:
* 'status' - When the client's login sequence status has changed
* 'join' - When the client has joined the server after authenticating
* 'spawn' - When the client has spawned into the game world, as it is getting chunks
* 'kick' - The server has kicked the client
* 'close' - The server has closed the connection
* 'error' - An recoverable exception has happened. Not catching will throw an exception
* 'connect_allowed' - Emitted after the client has pinged the server and gets version information.
* 'heartbeat' - Emitted after two successful tick_sync (keepalive) packets have been sent bidirectionally
* 'packet' - Emitted for all packets received by client
* 'session' - When the client has finished authenticating and connecting

## be.createServer(options) : Server

Returns a `Server` instance and starts listening for clients. All clients will be
authenticated unless offline is set to true.

`options` is an object containing the properties :

| Parameter   | Optionality | Description |
| ----------- | ----------- |-|
| host        | **Required** | The host to bind to. use `0.0.0.0` to bind all IPv4 addresses. |
| port        | *optional* |  the port to bind to, default **19132**     |
| version     | *optional* |  Version to run server as. Clients below this version will be kicked, clients above will still be permitted. |
| offline     | *optional* |  default to **false**. Set this to true to disable Microsoft/Xbox auth enforcement.   |
| maxPlayers | *optional* | default to **3**. Set this to change the maximum number of players connected.   |
| kickTimeout | *[Future][1]* | How long to wait before kicking a unresponsive client. |
| motd        | *optional* | The "message of the day" for the server, the message shown to players in the server list. See usage below. |
| advertisementFn | *optional* | optional. Custom function to call that should return a ServerAdvertisement, used for setting the RakNet server PONG data. Overrides `motd`. |
| conLog | *optional* | Where to log connection information (server join, kick messages to). Default to log only in DEBUG mode. |
| raknetBackend | *optional* | Specifies the raknet implementation to use. Possible options are 'raknet-native' (default, original C++ implementation), 'jsp-raknet' (JS port), and 'raknet-node' (Rust port). Please note when using the non-JS implementation you may the need approporate build tools on your system (for example a C++ or Rust compiler). |

*`useNativeRaknet` is deprecated. Setting to true will use 'raknet-native' for `raknetBackend` and setting it to false will use a JavaScript implemenation (jsp-raknet)*

## be.ping({ host, port }) : ServerAdvertisement

Ping a server and get the response. See type definitions for the structure.

## Server usage

You can create a server as such:
```js
const bedrock = require('bedrock-protocol')
const server = bedrock.createServer({
  host: '0.0.0.0',   // the host to bind to, use '0.0.0.0' to bind all hosts
  port: 19132,       // optional, port to bind to, default 19132
  offline: false,    // default false. verify connections with XBL
  motd: {
    motd: 'Funtime Server', // Top level message shown in server list
    levelName: 'Wonderland' // Sub-level header
  }
})
```

Then you can listen for clients and their events:
```js
// The 'connect' event is emitted after a new client has started a connection with the server and is handshaking.
// Its one paramater is the ServerPlayer class instance which handles this players' session from here on out.
server.on('connect', (client) => {
  // 'join' is emitted after the client has authenticated & connection is now encrypted.
  client.on('join', () => {
    // Then we can continue with the server spawning sequence. See examples/serverTest.js for an example  spawn sequence.
    // ...
    // Here's an example of sending a "text" packet, https://prismarinejs.github.io/minecraft-data/?v=bedrock_1.19.60&d=protocol#packet_text
    client.queue('text', { type: 'system', message: client.profile.name + ' just joined the server!' })
  })
})

```

Server event emissions:
* 'connect' - emitted by `Server` after a client first joins the server. Second paramater is a `ServerPlayer` instance.

'error' event is emitted when a catchable exception happens with a client (for example receiving a bad encrypted packet).

A ServerPlayer instance also emits the following special events:
* 'join' - the client is ready to recieve game packets after successful server-client handshake/encryption
* 'close' - emitted when client quit the server
* 'login' - emitted after identity and client-data verification. The event value is `{ user, authentication }`, where `authentication` contains `authenticated`, `method` (`oidc`, `legacy`, or `offline`), and the verified issuer. Check `authenticated` rather than inferring trust from an XUID.
* 'spawn' - emitted after the client lets the server know that it has successfully spawned
* 'packet' - Emitted for all packets received by client

Offline identities are explicitly marked `authenticated: false`, and their self-asserted XUID is normalized to `0`.

## Client usage

You can create a client like below:
```js
const bedrock = require('bedrock-protocol')
const client = bedrock.createClient({
  host: '127.0.0.1',  // the host to bind to, use '0.0.0.0' to bind all hosts
  port: 19132,        // optional, port to bind to, default 19132
  username: 'Notch'   // Any profile name, only used internally for account caching when in online mode. In offline mode, the username to connect with.
})
```

```js
// The 'join' event is emitted after the player has authenticated
// and is ready to recieve chunks and start game packets
client.on('join', client => console.log('Player has joined!'))

// The 'spawn' event is emitted. The chunks have been sent and all is well.
client.on('spawn', client => console.log('Player has spawned!'))

// We can listen for text packets. See proto.yml for documentation.
client.on('text', (packet) => {
  console.log('Client got text packet', packet)
})

// For example, we can listen to https://prismarinejs.github.io/minecraft-data/?v=bedrock_1.19.60&d=protocol#packet_add_player
// and send them a chat message when a player joins saying hello. Note the lack of the `packet` prefix, and that the packet
// names and as explained in the "Protocol doc" section below, fields are all case sensitive!
client.on('add_player', (packet) => {
  client.queue('text', {
    type: 'chat', needs_translation: false, source_name: client.username, xuid: '', platform_chat_id: '', filtered_message: '',
    message: `Hey, ${packet.username} just joined!`
  })
})
```

Order of client event emissions:
* 'connect' - emitted after a client first joins the server
* 'login' - emitted after the client has been authenticated by the server
* 'join' - the client is ready to recieve game packets after successful server-client handshake
* 'spawn' - emitted after the client has permission from the server to spawn

## Methods

[See the type defintions for this library for more information on methods.](../index.d.ts)

Both Client and ServerPlayer classes have `write(name, params)` and `queue(name, params)` methods. The former sends a packet immediately, and the latter queues them to be sent in the next packet batch. Prefer the latter for better performance and less blocking.

You can use `.close()` to terminate a connection, and `.disconnect(reason)` to gracefully kick a connected client.

### Running commands

Send a `command_request` and correlate the server's `command_output` back to it with `origin.uuid`, which the server echoes:

```js
const { randomUUID } = require('crypto')

const uuid = randomUUID()
client.on('command_output', (packet) => {
  if (packet.origin.uuid === uuid) console.log(packet.output)
})

client.queue('command_request', {
  command: '/list',
  origin: {
    type: 'player',
    uuid,
    request_id: '',
    player_entity_id: 0n // 1.26.x and above only, see below
  },
  internal: false,
  version: 'latest' // see below
})
```

Two fields are version dependent, and getting either wrong on 1.26.x produces a **terminating** `packet_violation_warning` whose reason reads `Command exceeds maximum size of 512 characters.` regardless of the actual cause — it is boilerplate, so don't read it as being about the command length:

* `version` is a varint on 1.21.x and below, and a string from 1.21.130 onwards. On 1.26.x pass the string `'latest'`; numeric-looking values such as `'52'` are rejected.
* `origin.player_entity_id` is behind a switch on 1.21.x and below (so a `player` origin omits it), but is an unconditional `li64` from 1.21.130 onwards. Omitting it there throws while serializing, before anything is sent.

Note that `command_output.output_type` is a string from 1.21.130 onwards rather than the older enum, and on 1.26.x the complete-output value is spelled `'alloutput'` where the old enum called it `'all'`. Some commands, such as `/say`, produce no `command_output` for the sender at all, so don't await one.

### Protocol docs

For documentation on the protocol, and packets/fields see the [the protocol doc](https://prismarinejs.github.io/minecraft-data/?v=bedrock_1.18.0&d=protocol) (the emitted event names are the Packet types in lower case without the "packet_" prefix). More information on syntax can be found in CONTRIBUTING.md. When sending a packet, you must fill out all of the required fields.

### Realm docs

To make joining a Realm easier we've added an optional `realm` property to the client. It accepts the following options `realmId`, `realmInvite`, and `pickRealm`, supplying one of these will fetch host/port information for the specified Realm and then attempt to connect the bot.
 - `realmId` - The id of the Realm to join.
 - `realmInvite` - The invite code/link of the Realm to join.
 - `pickRealm` - A function that will be called with a list of Realms to pick from. The function should return the Realm to join.

```js
const bedrock = require('bedrock-protocol')
const client = bedrock.createClient({
  realms: {
    pickRealm: (realms) => realms[0] // Function which recieves an array of joined/owned Realms and must return a single Realm. Can be async
  }
})
```


### Proxy docs

You can create a proxy ("Relay") to create a machine-in-the-middle (MITM) connection to a server. You can observe and intercept packets as they go through. The Relay is a server+client combo with some special packet handling and forwarding that takes care of the authentication and encryption on the server side. Clients will be asked to login if `offline` is not specified on connection.

```js
const { Relay } = require('bedrock-protocol')
const relay = new Relay({
  version: '1.16.220', // The version
  /* host and port to listen for clients on */
  host: '0.0.0.0',
  port: 19132,
  /* Where to send upstream packets to */
  destination: {
    host: '127.0.0.1',
    port: 19131
  }
})
relay.listen() // Tell the server to start listening.

relay.on('connect', player => {
  console.log('New connection', player.connection.address)

  // Server is sending a message to the client.
  player.on('clientbound', ({ name, params }, des) => {
    if (name === 'disconnect') { // Intercept kick
      params.message = 'Intercepted' // Change kick message to "Intercepted"
    }
  })
  // Client is sending a message to the server
  player.on('serverbound', ({ name, params }, des) => {
    if (name === 'text') { // Intercept chat message to server and append time.
      params.message += `, on ${new Date().toLocaleString()}`
    }
    
    if (name === 'command_request') { // Intercept command request to server and cancel if its "/test"
      if (params.command == "/test") {
        des.canceled = true
      }
    }
  })
})
```

'Relay' emits 'clientbound' and 'serverbound' events, along with the data for the outgoing packet that can be modified. You can send a packet to the client with `player.queue()` or to the backend server with `player.upstream.queue()`.

### Nethernet transport

Clients, servers, and relay destinations accept `transport: 'nethernet'`. The default remains
`'raknet'`. Nethernet carries Minecraft packets over WebRTC; the WebRTC connection provides
transport encryption, while Minecraft authentication still follows the `offline` option.

| Option | Description |
| --- | --- |
| `nethernet.networkId` | Remote network ID for a client, or local ID for a server. Use a `bigint` or string to preserve 64-bit IDs. `createServer` generates an ID when omitted. |
| `host` | For a Nethernet client, the address for LAN discovery (default `255.255.255.255`); for a server, the local bind address. |
| `nethernet.signalling` | `'lan'` (default) or `'services'` for authenticated Minecraft services signalling. Services mode skips the initial LAN advertisement lookup. Hosting with `'services'` publishes an Xbox world session. |
| `nethernet.webrtcBackend` | `'werift'` (default, pure JavaScript), `'wrtc'` (requires a separately installed `@roamhq/wrtc`), or `'auto'` (native when loadable, otherwise Werift). |
| `nethernet.signallingConnectTimeout` | Maximum wait for signalling credentials, including authentication, in milliseconds. Defaults to 15000. Applies to initial connection and reconnect attempts. |
| `authflow` | Optional existing `prismarine-auth` `Authflow`, shared by Minecraft authentication, Realms, and signalling. |

The deadlines apply to separate stages: `pingTimeout` bounds advertisement lookup;
`nethernet.signallingConnectTimeout` bounds services signalling setup through receipt of ICE
credentials (and each reconnect); `connectTimeout` bounds transport establishment after
setup. They are not one total timeout and do not bound Minecraft login or spawning.
Standalone `ping({ ..., timeout })` sets the lookup deadline for that individual call.

Xbox session hosting advertises `ConnectionType: 7` with `NetherNetId`, matching the
retail 1.26.51 capture. Receiving clients select the ID by field presence.

LAN example:

```js
const client = bedrock.createClient({
  transport: 'nethernet',
  host: '192.168.1.10',
  nethernet: { networkId: 123456789n, signalling: 'lan' },
  version: '1.26.45',
  username: 'Player',
  offline: true // only when the target server permits offline authentication
})
client.on('error', console.error)
```

Version 7 LAN advertisements select a supported game version automatically, unless `version`
is explicitly supplied. Version 4 advertisements have no game version; connections without
an explicit version use the library default. Use `ping({ nethernet: { networkId }, host, timeout, signal })`
for LAN discovery (`timeout` in milliseconds and `signal` as an optional AbortSignal); it returns a `NethernetServerAdvertisement`. Its `version` is the discovery
layout number (4 or 7), and `gameVersion` is the Minecraft version. The exported class supports
`fromBuffer(buffer)` and `toBuffer()` for binary advertisements. Only layouts 4 and 7 are
supported. Unknown trailing bytes are ignored. Direct `fromBuffer` calls can throw for an
unknown layout or an unreadable required field; LAN discovery ignores those replies and
continues waiting until a valid reply arrives, the timeout expires, or it is cancelled.
Encoding and field validation use ProtoDef's built-in types. Version 4
MOTD and world names must each fit in 255 UTF-8 bytes. Server advertisements reflect whether
self-signed logins are permitted by the `offline` option. See
[advertisement layouts](nethernet-advertisements.md) for field order and version differences.

For Realms, use the existing `realms` options. The join response automatically selects the
transport and nested Nethernet settings, including the network ID and regional signalling endpoint:

```js
const client = bedrock.createClient({ realms: { realmId: '123456' } })
client.on('error', console.error)
```

To select a friend's Xbox world, provide `world: { pickSession }`. The callback receives the
available sessions and returns one, synchronously or asynchronously. This selects Nethernet
and authenticated signalling automatically. See `examples/client/nethernet.js`.

Relay destinations accept the same `nethernet: { networkId, signalling, signallingConnectTimeout, webrtcBackend }`
object, alongside `transport`, `host`, and the existing `realms` options. An omitted transport retains
RakNet behavior. For a Nethernet server published to friends, see `examples/server/nethernet.js`;
account configuration includes `username`, `profilesFolder`, `authflow`, and `onMsaCode`.

Connection and signalling failures emit `error` on the owning client/server and close its
resources. Closing a client or server also closes its signalling connection and leaves its Xbox
session, including when closed during startup. If an Xbox session can no longer be maintained,
the owner emits an error and closes; it does not silently create or join a different session.

### Discovering Nethernet without a network ID

`await ping({ transport: 'nethernet', host: '127.0.0.1', timeout: 5000 })`
returns the first readable LAN advertisement from that host. The result includes
`networkId` (a bigint) and `raw` (the hexadecimal advertisement). Supply
`nethernet: { networkId }` to filter discovery to a known server. Discovery opens
no WebRTC connection and does not require support for the advertised game version.
Nethernet uses UDP 7551 and requires LAN visibility; the HTTP signalling port is
not a discovery port. If multiple servers are discoverable, specify a network ID.

RakNet `ping({ host, port })` also returns `raw`, containing the original
semicolon-separated advertisement.
