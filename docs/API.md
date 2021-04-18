# Documentation

## be.createClient(options) : Client

Returns a `Client` instance and connects to the server.

`options` is an object containing the properties :

| Paramater   | Optionality | Description |
| ----------- | ----------- |-|
| host        | **Required** |  Hostname to connect to, for example `127.0.0.1`. |
| port        | *optional* |  port to connect to, default to **19132**     |
| version     | *optional* |  Version to connect as. <br/>(Future feature, see [#69][1]) If not specified, should automatically match server version. <br/>(Current feature) Defaults to latest version. |
| offline     | *optional* |  default to **false**. Set this to true to disable Microsoft/Xbox auth.   |
| username    | Conditional | Required if `offline` set to true : Username to connect to server as.     |
| connectTimeout | *optional* | default to **9000ms**. How long to wait in milliseconds while trying to connect to server. |
| onMsaCode   | *optional* |  Callback called when signing in with a microsoft account with device code auth, `data` is an object documented [here](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-device-code#device-authorization-response) |
| autoInitPlayer | optional |  default to true, If we should send SetPlayerInitialized to the server after getting play_status spawn.    |


## be.createServer(options) : Server

Returns a `Server` instance and starts listening for clients. All clients will be
authenticated unless offline is set to true.

`options` is an object containing the properties :

| Paramater   | Optionality | Description |
| ----------- | ----------- |-|
| host        | **Required** | The hostname to bind to. use `0.0.0.0` to bind all IPv4 addresses. |
| port        | *optional* |  the port to bind to, default **19132**     |
| version     | *optional* |  Version to run server as. Clients below this version will be kicked, clients above will still be permitted. |
| offline     | *optional* |  default to **false**. Set this to true to disable Microsoft/Xbox auth enforcement.   |
| maxPlayers | *[Future][1]* | default to **3**. Set this to change the maximum number of players connected.   |
| kickTimeout | *[Future][1]* | How long to wait before kicking a unresponsive client. |
| motd        | *[Future][1]* | ServerAdvertisement instance. The server advertisment shown to clients, including the message of the day, level name. |
| advertismentFn | *[Future][1]* | optional. Custom function to call that should return a ServerAdvertisement, used for setting the RakNet server PONG data. Overrides `motd`. |

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
  host: '0.0.0.0',   // the hostname to bind to, use '0.0.0.0' to bind all hostnames
  port: 19132,       // optional, port to bind to, default 19132
  offline: false     // default false. verify connections with XBL
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

Order of server client event emisions:
* 'connect' - emitted by `Server` after a client first joins the server. Second paramater is a `ServerPlayer` instance.
* 'login' - emitted by client after the client has been authenticated by the server
* 'join' - the client is ready to recieve game packets after successful server-client handshake/encryption
* 'spawn' - emitted after the client lets the server know that it has successfully spawned

## Client docs

You can create a server as such:
```js
const bedrock = require('bedrock-protocol')
const client = bedrock.createClient({
  host: '127.0.0.1',  // the hostname to bind to, use '0.0.0.0' to bind all hostnames
  port: 19132,        // optional, port to bind to, default 19132
  username: 'Notch'   // Any profile name, only used internally for account caching. You'll
                      // be asked to sign-in with Xbox Live the first time.
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

Order of client event emisions:
* 'connect' - emitted after a client first joins the server
* 'login' - emitted after the client has been authenticated by the server
* 'join' - the client is ready to recieve game packets after successful server-client handshake
* 'spawn' - emitted after the client has permission from the server to spawn

[1]: https://github.com/PrismarineJS/bedrock-protocol/issues/69
