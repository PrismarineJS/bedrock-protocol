# Documentation

## be.createClient(options) : Client

Returns a `Client` instance and connects to the server.

`options` is an object containing the properties :

| Parameter   | Optionality | Description |
| ----------- | ----------- |-|
| host        | **Required** |  host to connect to, for example `127.0.0.1`. |
| port        | *optional* |  port to connect to, default to **19132**     |
| version     | *optional* |  Version to connect as. If not specified, automatically match server version. |
| offline     | *optional* |  default to **false**. Set this to true to disable Microsoft/Xbox auth.   |
| username    | Conditional | Required if `offline` set to true : Username to connect to server as.     |
| authTitle   | *optional* | The title ID to connect as, see the README for usage.     |
| connectTimeout | *optional* | default to **9000ms**. How long to wait in milliseconds while trying to connect to server. |
| onMsaCode   | *optional* |  Callback called when signing in with a microsoft account with device code auth, `data` is an object documented [here](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-device-code#device-authorization-response) |
| profilesFolder | *optional* | Where to store cached authentication tokens. Defaults to .minecraft, or the node_modules folder if not found. |
| autoInitPlayer | *optional* |  default to true, If we should send SetPlayerInitialized to the server after getting play_status spawn.    |
| skipPing | *optional* | Whether pinging the server to check its version should be skipped. |
| useNativeRaknet | *optional* | Whether to use the C++ version of RakNet. Set to false to use JS. |

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
    name: 'Funtime Server', // Top level message shown in server list
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

Order of server client event emissions:
* 'connect' - emitted by `Server` after a client first joins the server. Second paramater is a `ServerPlayer` instance.
* 'login' - emitted by client after the client has been authenticated by the server
* 'join' - the client is ready to recieve game packets after successful server-client handshake/encryption
* 'spawn' - emitted after the client lets the server know that it has successfully spawned

## Client docs

You can create a server as such:
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
client.on('join', client => console.log('Player has spawned!'))

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

### Protocol docs

For documentation on the protocol, and packets/fields see the [proto.yml](data/latest/proto.yml) and [types.yml](data/latest/proto.yml) files. More information on syntax can be found in CONTRIBUTING.md. When sending a packet, you must fill out all of the required fields.


### Proxy docs

You can create a proxy ("Relay") to create a machine-in-the-middle (MITM) connection to a server. You can observe and intercept packets as they go through. The Relay is a server+client combo with some special packet handling and forwarding that takes care of the authentication and encryption on the server side. You'll be asked to login if `offline` is not specified once you connect.

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
