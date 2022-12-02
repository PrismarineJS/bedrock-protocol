# bedrock-protocol
[![NPM version](https://img.shields.io/npm/v/bedrock-protocol.svg)](http://npmjs.com/package/bedrock-protocol)
[![Build Status](https://github.com/PrismarineJS/bedrock-protocol/workflows/CI/badge.svg)](https://github.com/PrismarineJS/bedrock-protocol/actions?query=workflow%3A%22CI%22)
[![Try it on gitpod](https://img.shields.io/badge/try-on%20gitpod-brightgreen.svg)](https://gitpod.io/#https://github.com/PrismarineJS/bedrock-protocol)

[![Official Discord](https://img.shields.io/static/v1.svg?label=OFFICIAL&message=DISCORD&color=blue&logo=discord&style=for-the-badge)](https://discord.gg/GsEFRM8)

Minecraft Bedrock Edition (aka MCPE) protocol library, supporting authentication and encryption. Help [contribute](CONTRIBUTING.md).

[Protocol doc](https://minecraft-data.prismarine.js.org/?v=bedrock_1.19.10&d=protocol)

## Features

 - Supports Minecraft Bedrock version 1.16.201, 1.16.210, 1.16.220, 1.17.0, 1.17.10, 1.17.30, 1.17.40, 1.18.0, 1.18.11, 1.18.30, 1.19.1, 1.19.10, 1.19.20, 1.19.21, 1.19.30, 1.19.40, 1.19.41, 1.19.50
 - Parse and serialize packets as JavaScript objects
 - Automatically respond to keep-alive packets
 - [Proxy and mitm connections](docs/API.md#proxy-docs)
 - Client
   - Authentication
   - Encryption
   - [Ping a server for status](docs/API.md#beping-host-port---serveradvertisement)
 - Server
   - Autheticate clients with Xbox Live 
   - Ping status

 * Robust test coverage.
 * Easily extend with many other PrismarineJS projects, world providers, and more 
 * Optimized for rapidly staying up to date with Minecraft protocol updates.


Want to contribute on something important for PrismarineJS ? go to https://github.com/PrismarineJS/mineflayer/wiki/Big-Prismarine-projects

## Installation

`npm install bedrock-protocol`

## Usage

### Client example

Example to connect to a server in offline mode, and relay chat messages back:

```js
const bedrock = require('bedrock-protocol')
const client = bedrock.createClient({
  host: 'localhost',   // optional
  port: 19132,         // optional, default 19132
  username: 'Notch',   // the username you want to join as, optional if online mode
  offline: true       // optional, default false. if true, do not login with Xbox Live. You will not be asked to sign-in if set to true.
})

client.on('text', (packet) => { // Listen for chat messages and echo them back.
  if (packet.source_name != client.username) {
    client.queue('text', {
      type: 'chat', needs_translation: false, source_name: client.username, xuid: '', platform_chat_id: '',
      message: `${packet.source_name} said: ${packet.message} on ${new Date().toLocaleString()}`
    })
  }
})
```

### Client example joining a Realm

Example to connect to a Realm that the authenticating account is owner of or has been invited to:

```js
const bedrock = require('bedrock-protocol')
const client = bedrock.createClient({
  realms: {
    pickRealm: (realms) => realms[0] // Function which recieves an array of joined/owned Realms and must return a single Realm. Can be async
  }
})
```

### Server example

*Can't connect locally on Windows? See the [faq](docs/FAQ.md)*
```js
const bedrock = require('bedrock-protocol')
const server = bedrock.createServer({
  host: '0.0.0.0',       // optional. host to bind as.
  port: 19132,           // optional
  version: '1.17.10',   // optional. The server version, latest if not specified. 
})

server.on('connect', client => {
  client.on('join', () => { // The client has joined the server.
    const d = new Date()  // Once client is in the server, send a colorful kick message
    client.disconnect(`Good ${d.getHours() < 12 ? '§emorning§r' : '§3afternoon§r'} :)\n\nMy time is ${d.toLocaleString()} !`)
  })
})
```

### Ping example

```js
const { ping } = require('bedrock-protocol')
ping({ host: 'play.cubecraft.net', port: 19132 }).then(res => {
  console.log(res)
})
```

## Documentation

For documentation on the protocol, and packets/fields see the [protocol documentation](https://minecraft-data.prismarine.js.org/protocol/).

* See [API documentation](docs/API.md)

* See [frequently asked questions and answers](docs/FAQ.md)

<!-- ## Projects Using bedrock-protocol

 * [mineflayer](https://github.com/PrismarineJS/mineflayer/) - create bots with a stable, high level API.
 * [pakkit](https://github.com/Heath123/pakkit) To monitor your packets
 * [flying-squid](https://github.com/PrismarineJS/flying-squid/) - create minecraft bots with a stable, high level API. -->

## Testing

```npm test```

## Debugging

You can enable some protocol debugging output using `DEBUG` environment variable.

Through node.js, add `process.env.DEBUG = 'minecraft-protocol'` at the top of your script.

## Contribute

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and https://github.com/PrismarineJS/prismarine-contribute

## History

See [history](HISTORY.md)

<!-- ## Related

* [map-colors](https://github.com/AresRPG/aresrpg-map-colors) can be used to convert any image into a buffer of minecraft compatible colors -->
