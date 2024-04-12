1. index.js -- ran initially on CRON to check for updates
2. update1.js -- runs bedrock-protocol client against the updated server to collect data from server->client. Also runs a behavior pack to extract block data.
3. disa.exe -- disassembly analysis for Minecraft bedrock edition server binary (combining data from both Linux/Win binaries)
  * x86 disassembly for the server software with symbol information is analogus to decompiling the Minecraft Java Edition
    and running various extractors on the decompiled code.
  * Can be expanded to extract pretty much any desired data from the server software
4. pdba.exe -- analysis of PDB file for Minecraft bedrock edition Windows server binary
5. update3.js -- aggregate and finalize data, send to llm-services for further handling
