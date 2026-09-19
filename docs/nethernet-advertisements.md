# Nethernet advertisement layouts

These are binary LAN discovery payloads, separate from the semicolon-delimited RakNet
advertisement. The first byte is the advertisement layout version, not the Minecraft game
version. The schemas live in [`src/nethernet/advertisement.json`](../src/nethernet/advertisement.json).

The library supports layouts 4 and 7. The v7 test fixture was captured from an official
Bedrock Dedicated Server 1.26.51.1. This fixture does not establish the first game release
that used v7, or the meanings of layouts 5 and 6; unsupported layout numbers are not guessed.

| Property | Layout 4 | Layout 7 |
| --- | --- | --- |
| Layout tag | `u8`, value 4 | `u8`, value 7 |
| String lengths | `u8` UTF-8 byte count (maximum 255 bytes) | `varint` UTF-8 byte count |
| MOTD and world name | Present | Present |
| Minecraft protocol and game version | Absent | `protocol` and `gameVersion` |
| Player counts | Signed little-endian 32-bit integers | Signed ZigZag varints (`zigzag32`) |
| Game mode | `u8`, before player counts | `zigzag32`, after player counts |
| Editor/hardcore flags | Optional trailing bytes in this decoder | Required boolean fields |
| Authentication flags | Absent | `acceptsOnlineAuth`, `acceptsSelfSignedAuth` |
| Other fields | Two optional bytes of unknown meaning | `nonce` string and `connectionType` ZigZag integer |

In wire order:

- **v4:** `version`, `motd`, `levelName`, `gamemodeId`, `playerCount`, `playersMax`,
  then `isEditorWorld`, `hardcore`, `unknown1`, `unknown2`.
- **v7:** `version`, `motd`, `protocol`, `gameVersion`, `levelName`, `playerCount`,
  `playersMax`, `gamemodeId`, `isEditorWorld`, `hardcore`, `acceptsOnlineAuth`,
  `acceptsSelfSignedAuth`, `nonce`, `connectionType`.

The v4 decoder preserves the previous implementation's tolerance for any missing suffix of
its four trailer bytes. Missing fields retain the class defaults: `false`, `false`, `4`, `8`.
This is a compatibility policy, not a claim that every shortened trailer is an official layout.
Encoding v4 always writes all four bytes. Their names and defaults do not establish meanings
for `unknown1` or `unknown2`.

Version 7 adds enough information to select a supported Minecraft game version automatically.
Version 4 cannot do that: although the returned class has default `protocol` and `gameVersion`
properties, those values did not come from the peer. The client uses an explicitly configured
version or the library default for v4. An explicit client version also overrides v7 discovery.

New advertisements default to v7. Server-generated v7 advertisements allow online authentication
and advertise self-signed authentication only when `offline: true`. These discovery flags describe
capabilities; login verification still determines whether a connection is accepted. The library
currently defaults `nonce` to an empty string and `connectionType` to 4.

## Tolerance and errors

Both decoders ignore extra bytes after the known fields; those bytes are not preserved when
re-encoding. Missing required fields and unknown layouts can still make `fromBuffer` throw.
Direct callers should catch that error. During LAN discovery, decoding happens inside the pong
handler's error boundary: an unreadable advertisement is debug-logged and ignored, allowing a
later valid response to succeed. Bad replies do not extend the original timeout. If no valid
reply arrives, `ping()` rejects normally; callers should handle that rejection (and client
applications should register an `error` listener).

Outbound validation applies to values supplied by the application. It checks string types,
v4 string byte limits, and signed 32-bit integer ranges before writing. ProtoDef supplies the
binary readers/writers directly; there are no advertisement-specific varint overrides.
