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
