## 3.36.0
* [Support 1.20.80](https://github.com/PrismarineJS/bedrock-protocol/commit/bd32aa8d04555fa2fdc4ecd6abbeb6124e2ae8bb) (thanks @extremeheat)

## 3.35.0
* [Support 1.20.71](https://github.com/PrismarineJS/bedrock-protocol/commit/d8e707112acc038b6c9564d9a21b2f977326e47f) (thanks @extremeheat)
* [Note `npm update` command in readme](https://github.com/PrismarineJS/bedrock-protocol/commit/ab93d0d0824bd0ace250fb73f703dc7b60ecd780) (thanks @extremeheat)

## 3.34.0
* [1.20.61 support (#480)](https://github.com/PrismarineJS/bedrock-protocol/commit/c278a03f952d23320b80f8c09b6372d41eeff26a) (thanks @extremeheat)
* [Compressor handling update for 1.20.60 (#479)](https://github.com/PrismarineJS/bedrock-protocol/commit/d3161badc65f2eba4b6e7c9e974ca4e3529a7e94) (thanks @extremeheat)
* [Update and rename CONTRIBUTING.md to docs/CONTRIBUTING.md (#475)](https://github.com/PrismarineJS/bedrock-protocol/commit/be6f0cde9f7970a4f9aa376c589c58d8cb4187c3) (thanks @extremeheat)
* [Add flow and deviceType options to relay (#464)](https://github.com/PrismarineJS/bedrock-protocol/commit/842e66266f09e8670a644a618d0ac4157746cd43) (thanks @GameParrot)

## 3.33.1
* [Fix zigzag type move in prismarine-nbt (#471)](https://github.com/PrismarineJS/bedrock-protocol/commit/7b74cbf7129646adc80d50304afce6240848cfae) (thanks @extremeheat)

## 3.33.0
* [1.20.50 (#466)](https://github.com/PrismarineJS/bedrock-protocol/commit/d53211c6a1fe5f941ce547886ad6ec031ae05d9d) (thanks @extremeheat)
* [Add 1.20.30 and 1.20.40 to index.d.ts (#461)](https://github.com/PrismarineJS/bedrock-protocol/commit/2ecf01d63e64b910b87f303fc4fb2b30f392cb28) (thanks @CreeperG16)

## 3.32.0
* [1.20.40 support (#459)](https://github.com/PrismarineJS/bedrock-protocol/commit/63eb673c1f30beb58f97e3b37295129000bf6a10) (thanks @CreeperG16)
* [Update Minecraft wiki link to new domain (#455)](https://github.com/PrismarineJS/bedrock-protocol/commit/689658c4ab1ccb3ef1ae812d78d090212b1acf3f) (thanks @Spongecade)

## 3.31.0
* [1.20.30](https://github.com/PrismarineJS/bedrock-protocol/commit/22502b90fdc29f6327239c6c201370c8f839c892) (thanks @extremeheat)
* [Add links field to server resource_packs_info](https://github.com/PrismarineJS/bedrock-protocol/commit/f92db61c89851dfbdbc906f926fc1433162854d0) (thanks @extremeheat)
* [Update API.md (#448)](https://github.com/PrismarineJS/bedrock-protocol/commit/8f3b6c5aecf24d6f8d235afe2a9d911840e6a3f8) (thanks @Laamy)

## 3.30.1
* [Update Mojang public key used for logins (#443)](https://github.com/PrismarineJS/bedrock-protocol/commit/f0f1351d40966192e38ee9fe21b7c37754abba04) (thanks @GameParrot)
* [index.d.ts: Fixed a typo (#441)](https://github.com/PrismarineJS/bedrock-protocol/commit/2c00402a9e9a0a283e712bf4f52190a57ea12c3f) (thanks @kotinash)
* [Mark `listen` and `close` as async (#440)](https://github.com/PrismarineJS/bedrock-protocol/commit/50cd489f6e16fa6fe04b1825617d8246bd3935f4) (thanks @MrSterdy)
* [Stop disconnecting when upstream packet deserialization fails (#435)](https://github.com/PrismarineJS/bedrock-protocol/commit/141442057464b3247ace8468863f27a3c334306e) (thanks @MrSterdy)
* [Add 1.20.0 and 1.20.10 to index.d.ts (#431)](https://github.com/PrismarineJS/bedrock-protocol/commit/010d57e78a9130c612e48db7a32f841de83e9c68) (thanks @CreeperG16)

## 3.30.0
* 1.20.10 support (thanks @CreeperG16)
* [Fix upstream relay batchingInterval (#425)](https://github.com/PrismarineJS/bedrock-protocol/commit/b2c141c25f3fad9641644742b6cc1a71bc601d61) (thanks @GameParrot)

## 3.29.1
* Add missing data to client login user chain (#420)
* Add FAQ entry and replit warning on client ping error (#415)
* Types: Fix Relay authTitle type (#418)

## 3.29.0
* 1.20.0 support

## 3.28.1
* Fix `followPort` option (@LucienHH)
* Typescript definition fixes (@hvlxh)

## 3.28.0
* 1.19.80 support

## 3.27.1
* Fix `raknetBackend` option not being applied correctly

## 3.27.0
* Corrections to types (@stevarino)
* Expose ServerAdvertisement class (#368) @hvlxh
* Update mc-data links

## 3.26.0
* 1.19.70 support (@CreeperG16)
* types: add some type hints (#354) @hvlxh

## 3.25.0
* 1.19.63 support (@stevarino)
* Add close packet in server player API doc (#347) @hvlxh

## 3.24.0
* 1.19.62 support (@CreeperG16)

## 3.23.0
* 1.19.60 support (@CreeperG16)
* added onMsaCode, profilesFolder to ClientOptions (@jarco-dev)

## 3.22.0
* 1.19.50 support (@WillQizza)

## 3.21.0
* 1.19.40 support (#314)
* types: Fix missing field in ServerAdvertisement (#313) (@minerj101)

## 3.20.1
* Fix buffer length calculation in ServerAdvertisement (#292) (thanks @KurtThiemann)
* Handle Relay serialization errors by kicking (#290)

## 3.20.0
* Preliminary 1.19.30 support, improve error handling and server pong data (#284)

## 3.19.0
* Add option for port redirection, fix Realm handling (#282) 
* Add Port Redirect Functionality (#278) @stevarino
* Add Get-AppxPackage command to FAQ.md (#276) @stevarino
* Remove viewer example

## 3.18.0
* 1.19.21 support (#266)

## 3.17.0
* relay: Add multi-user login support (#258) 
* Add fields from 1.19.20 to login chain data (#259) @CleSucre
* Fix nbt encoding size on single null tag NBT (#264)
* test: Add -u flag unzipping vanilla server (#262) 

## 3.16.0
* 1.19.20 support (#251)
* Add new raknet library option (raknet-node) (#211) @b23r0

## 3.15.0
* 1.19.10 support
* Remove Realm fetch when joining via invite (#228) @LucienHH 
* Add Realm support to Relay (#226) @ATXLtheAxolotl

## 3.14.0
* 1.19 support
* Better handle ping timeout, update documentation (#218) @stevarino

## 3.13.0
* Update API documentation
* Emit generic 'packet' event for server clients (#205) @ATXLtheAxolotl
* Add XUID field for client offline mode client chain (#203) 

## 3.12.0
* 1.18.30 support

## 3.11.1
* Bump minecraft-data version

## 3.11.0
* Implement Realm joining (#193) @LucienHH
* Refactor client connection sequence (#189) @extremeheat
* Add profilesFolder to Relay (#192) @CreeperG16
* Emit error from relay when server can't be pinged (#191)
* Pass relay onMsaCode to client (#190) @Heath123
* Mark raknet-native as required dependency (#188) 
* Ignore unconnected packets, remove babel (#185)

## 3.10.0
* Support 1.18.11 (#179) @extremeheat
* Switch to sync zlib with 512k chunks, adjustable compression level (#174) @extremeheat

## 3.9.0
* Proxy fixes, logging and doc updates [#169](https://github.com/PrismarineJS/bedrock-protocol/pull/169)

## 3.8.0
* 1.18.0 support

## 3.7.0
* 1.17.40 support

## 3.6.0
* 1.17.30 support
* minecraft-data used for protocol data

## 3.5.1
* Fix 1.17.10 npc packet serialization (#119)

## 3.5.0
* Add 1.17.10 support [#109](https://github.com/PrismarineJS/bedrock-protocol/pull/109)
* You can switch to the JS implementation of raknet by setting `useNativeRaknet: false` in options.

## 3.4.0
* Initial 1.17 support [#99](https://github.com/PrismarineJS/bedrock-protocol/pull/99)
* update connect version based on ping response & fix typings (u9g) [#101](https://github.com/PrismarineJS/bedrock-protocol/pull/101)
* fix: ping types. (JammSpread) [#100](https://github.com/PrismarineJS/bedrock-protocol/pull/100)

## 3.3.0
* Protocol updates for 1.16, with some minor breaking changes to protocol fields [#95](https://github.com/PrismarineJS/bedrock-protocol/pull/95)
* Fix npm install issues

## 3.2.1
* Add `authTitle` option to Relay proxy [#92](https://github.com/PrismarineJS/bedrock-protocol/pull/92)
* Protocol, type definition fixes

## 3.2.0

* Fix empty chunks on proxy spawn [#89](https://github.com/PrismarineJS/bedrock-protocol/pull/89)
* Send skin data to server [#88](https://github.com/PrismarineJS/bedrock-protocol/pull/88)
* Support xbox title + live.com auth [#86](https://github.com/PrismarineJS/bedrock-protocol/pull/86)
* Protocol updates and fixes
* Fix third party servers, optional client encryption [#83](https://github.com/PrismarineJS/bedrock-protocol/pull/83)

## 3.1.0
* Add support for 1.16
* New docs and examples
* Ping support
* Add microsoft authentication
* Codebase refactor

## 2.4.0
* Update to version 1.12.0
* Add option to provide protocol.json

## 2.2.3
* fix the use item packet

## 2.2.2
* fix the block update packet, for real this time

## 2.1.1
* fix the block update packet

## 2.1.0
* normalize names of packet fields
* update to version 0.14.2

## 2.0.1
* player list is now an array
* reconnecting has been fixed

## 2.0.0

* lot of raknet update that fix bugs
* the server example is working
* fix packets
* breaking : remove mcpe_ prefix in packet names
* encapsulated packet now emit actual errors

## 1.1.0

* raknet is integrated, packet parsing is working
* client login sequence is working
* server login sequence is almost there

## 1.0.0

* first version, protocol definition is there but nothing really works
