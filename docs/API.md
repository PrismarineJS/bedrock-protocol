# Documentation

## be.createClient(options) : Client

Returns a `Client` instance and connects to the server.

`options` is an object containing the properties :

| Parameter   | Optionality | Description |
| ----------- | ----------- |-|
| host        | Conditional | Not required if `realms` is set. host to connect to, for example `127.0.0.1`. |
| port        | *optional* |  port to connect to, default to **19132**     |
| version     | *optional* |  Version to connect as. If not specified, automatically match server version. |
| offline     | *optional* |  default to **false**. Set this to true to disable Microsoft/Xbox auth.   |
| username    | Required | The profile name to connect to the server as. If `offline` set to true, the username that will appear on join, that would normally be the Xbox Gamer Tag. |
| connectTimeout | *optional* | default to **9000ms**. How long to wait in milliseconds while trying to connect to server. |
| onMsaCode   | *optional* |  Callback called when signing in with a microsoft account with device code auth, `data` is an object documented [here](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-device-code#device-authorization-response) |
| profilesFolder | *optional* | Where to store cached authentication tokens. Defaults to .minecraft, or the node_modules folder if not found. |
| skipPing | *optional* | Whether pinging the server to check its version should be skipped. |
| followPort | *optional* | Update the options' port parameter to match the port broadcast on the server's ping data (default to true if `realms` not specified) |
| autoInitPlayer | *optional* |  default to true, If we should send SetPlayerInitialized to the server after getting play_status spawn.    |
| conLog | *optional* | Where to log connection information (server join, kick messages to). Defaults to console.log, set to `null` to not log anywhere. |
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

## Methods

[See the type defintions for this library for more information on methods.](../index.d.ts)

Both Client and Server classes have `write(name, params)` and `queue(name, params)` methods. The former sends a packet immediately, and the latter queues them to be sent in the next packet batch. Prefer the latter for better performance and less blocking.

You can use `.close()` to terminate a connection, and `.disconnect(reason)` to gracefully kick a connected client.

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
// Its one paramater is the client class instance which handles this session from here on out.
server.on('connect', (client) => {
  // 'join' is emitted after the client has authenticated & connection is now encrypted.
  client.on('join', () => {
    // Then we can continue with the server spawning sequence. See examples/serverTest.js for an example  spawn sequence.
  })
})

```

Server event emissions:
* 'connect' - emitted by `Server` after a client first joins the server. Second paramater is a `ServerPlayer` instance.

'error' event is emitted when a catchable exception happens with a client (for example receiving a bad encrypted packet).

A ServerPlayer instance also emits the following special events:
* 'join' - the client is ready to recieve game packets after successful server-client handshake/encryption
* 'login' - emitted by client after the client has been authenticated by the server
* 'spawn' - emitted after the client lets the server know that it has successfully spawned
* 'packet' - Emitted for all packets received by client

## Client docs

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
```

Order of client event emissions:
* 'connect' - emitted after a client first joins the server
* 'login' - emitted after the client has been authenticated by the server
* 'join' - the client is ready to recieve game packets after successful server-client handshake
* 'spawn' - emitted after the client has permission from the server to spawn

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

### Protocol docs

For documentation on the protocol, and packets/fields see the [the protocol doc](https://minecraft-data.prismarine.js.org/?v=bedrock_1.18.0&d=protocol) (the emitted event names are the Packet types in lower case without the "packet_" prefix). More information on syntax can be found in CONTRIBUTING.md. When sending a packet, you must fill out all of the required fields.


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
  player.on('clientbound', ({ name, params }) => {
    if (name === 'disconnect') { // Intercept kick
      params.message = 'Intercepted' // Change kick message to "Intercepted"
    }
  })
  // Client is sending a message to the server
  player.on('serverbound', ({ name, params }) => {
    if (name === 'text') { // Intercept chat message to server and append time.
      params.message += `, on ${new Date().toLocaleString()}`
    }
  })
})
```

'Relay' emits 'clientbound' and 'serverbound' events, along with the data for the outgoing packet that can be modified. You can send a packet to the client with `player.queue()` or to the backend server with `player.upstream.queue()`.
