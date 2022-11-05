# bedrock-protocol

Minecraft Bedrock Edition (aka MCPE) protocol library, supporting authentication and encryption. Help [contribute](CONTRIBUTING.md).

[Protocol doc](https://minecraft-data.prismarine.js.org/?v=bedrock_1.19.10&d=protocol)

<p align="left">
 <a href="http://npmjs.com/package/bedrock-protocol"><img width="85" alt="Bedrock-Protocol on NPM" src="https://img.shields.io/npm/v/bedrock-protocol.svg?style=flat&labelColor=2c2c2c"></a>
 <a href="https://github.com/PrismarineJS/bedrock-protocol/actions?query=workflow%3A%22CI%22">
  <img width="85" alt="CI workflow status" src="https://github.com/PrismarineJS/bedrock-protocol/workflows/CI/badge.svg"></a><br>
 <img src="https://img.shields.io/github/last-commit/PrismarineJS/bedrock-protocol?labelColor=2c2c2c" alt="Most recent commit to this repository" width="175"><br>
 <a href="https://gitpod.io/#https://github.com/PrismarineJS/bedrock-protocol"><img width="175" src="https://shields.io/badge/try-on%20gitpod-brightgreen.svg?style=for-the-badge&label=Try%20it%20&color=orange&logoWidth=28&logo=data:image/svg+xml;base64,PHN2ZyB2aWV3Qm94PSIwIDAgMTg5IDIwOCIgd2lkdGg9IjkwIiBoZWlnaHQ9IjEwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xMTIuMjg3IDEwLjM1ODRDMTE3LjkgMjAuMjEyOSAxMTQuNDg3IDMyLjc2NjYgMTA0LjY2NCAzOC4zOTc4TDQzLjU4NjIgNzMuNDFDNDEuOTY5MyA3NC4zMzY5IDQwLjk3MiA3Ni4wNTc3IDQwLjk3MiA3Ny45MjA5VjEzMi44OTlDNDAuOTcyIDEzNC43NjMgNDEuOTY5MyAxMzYuNDgzIDQzLjU4NjIgMTM3LjQxTDkxLjkxMjMgMTY1LjExM0M5My41MTUgMTY2LjAzMiA5NS40ODUgMTY2LjAzMiA5Ny4wODc3IDE2NS4xMTNMMTQ1LjQxNCAxMzcuNDFDMTQ3LjAzMSAxMzYuNDgzIDE0OC4wMjggMTM0Ljc2MyAxNDguMDI4IDEzMi44OTlWOTguNzA5MUwxMDQuNTY3IDEyMy4zMDlDOTQuNzEzMSAxMjguODg2IDgyLjIxNzkgMTI1LjM5NCA3Ni42NTgxIDExNS41MDlDNzEuMDk4MyAxMDUuNjI0IDc0LjU3OTMgOTMuMDg5MSA4NC40MzMxIDg3LjUxMTdMMTQ2LjYyIDUyLjMxMjhDMTY1LjU2MyA0MS41OTEgMTg5IDU1LjMyMSAxODkgNzcuMTM5OFYxMzcuMDY2QzE4OSAxNTEuMTAyIDE4MS41MDMgMTY0LjA2MiAxNjkuMzU1IDE3MS4wMjZMMTEzLjg0NCAyMDIuODQ3QzEwMS44NTggMjA5LjcxOCA4Ny4xNDI0IDIwOS43MTggNzUuMTU1OCAyMDIuODQ3TDE5LjY0NTMgMTcxLjAyNkM3LjQ5NzE0IDE2NC4wNjIgMCAxNTEuMTAyIDAgMTM3LjA2NlY3My43NTQ0QzAgNTkuNzE4NCA3LjQ5NzE0IDQ2Ljc1ODUgMTkuNjQ1MyAzOS43OTQ3TDg0LjMzNjEgMi43MTEyNUM5NC4xNTk1IC0yLjkxOTkzIDEwNi42NzMgMC41MDM4MDIgMTEyLjI4NyAxMC4zNTg0WiIgZmlsbD0idXJsKCNwYWludDBfbGluZWFyKSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJwYWludDBfbGluZWFyIiB4MT0iMTQyLjI1MyIgeTE9IjMxLjQ1MzciIHgyPSI0NC44MDUyIiB5Mj0iMTg0LjE3IiBncmFkaWVudFVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CjxzdG9wIHN0b3AtY29sb3I9IiNGRkI0NUIiLz4KPHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjRkY4QTAwIi8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPC9zdmc+Cg==&labelColor=2c2c2c" alt="Try bedrock-protocol on Gitpod.io"></a><br><a href="https://discord.gg/GsEFRM8"> <a href="https://discord.gg/GsEFRM8"><img width="175" src="https://img.shields.io/discord/413438066984747026?label=Discord&color=454FBF&logo=discord&logoWidth=22&logoColor=454FBF&labelColor=2c2c2c&style=for-the-badge" alt="Official PrismarineJS Discord server"></a><br>
 </p>

## Features

 - Supports Minecraft Bedrock version 1.16.201, 1.16.210, 1.16.220, 1.17.0, 1.17.10, 1.17.30, 1.17.40, 1.18.0, 1.18.11, 1.18.30, 1.19.1, 1.19.10, 1.19.20, 1.19.21, 1.19.30, 1.19.40
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

 <hr>
 <p align="center"><a href="https://github.com/PrismarineJS"><img src="https://i.imgur.com/lFZyg11.png" width="314"></a></p>
 
<!-- ## Related

* [map-colors](https://github.com/AresRPG/aresrpg-map-colors) can be used to convert any image into a buffer of minecraft compatible colors -->
