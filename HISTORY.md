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
