# Documentation

## be.createClient(options) : Client

Returns a `Client` instance and connects to the server.

`options` is an object containing the properties :
 * host : required. hostname to connect to, for example `127.0.0.1`.
 * port (optional) : port to connect to, default to 19132
 * version (optional) : default to latest stable version
 * autoInitPlayer (optional) : default to true, If we should send SetPlayerInitialized to the server after getting play_status spawn.
 * offline (optional) : default to false, whether to auth with microsoft
 * connectTimeout (optional) : default to 9000, ms to wait before aborting connection attempt


## be.createServer(options) : Server

Returns a `Server` instance and starts listening for clients. All clients will be
authenticated unless offline is set to true.

`options` is an object containing the properties :
 * host : required. the hostname to bind to. use `0.0.0.0` to bind all IPv4 addresses.
 * port (optional) : the port to bind to, default 19132
 * version (optional) : default to latest stable version
 * offline (optional) : default to false, whether to auth with microsoft
 * connectTimeout (optional) : default to 9000, ms to wait before aborting connection attempt

## Methods

[See the type defintions for this library for more information on methods.](../index.d.ts).

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
server.on('join', client => console.log('Player has joined!'))

// The 'spawn' event is emitted. The chunks have been sent and all is well.
server.on('join', client => console.log('Player has spawned!'))

// We can listen for text packets. See proto.yml for documentation.
server.on('text', (packet) => {
  console.log('Client got text packet', packet)
})
```

Order of client event emisions:
* 'connect' - emitted after a client first joins the server
* 'login' - emitted after the client has been authenticated by the server
* 'join' - the client is ready to recieve game packets after successful server-client handshake
* 'spawn' - emitted after the client has permission from the server to spawn