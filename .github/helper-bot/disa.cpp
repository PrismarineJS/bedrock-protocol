#include <fstream>
#include <iostream>
#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <vector>
#include <algorithm>
#include "disa.h"

char *roData;
int roDataOffset;
int roDataEnd;
void loadRoData(std::string binFile) {
  std::ifstream binStream(binFile, std::ios::binary);
  if (!binStream.is_open()) {
    std::cerr << "Failed to open file: " << binFile << std::endl;
    return;
  }
  binStream.seekg(0, std::ios::end);
  int size = binStream.tellg();
  binStream.seekg(0, std::ios::beg);
  roData = new char[size];
  binStream.read(roData, size);
  binStream.close();
  // End 9 bytes holds offset of the rodata section
  std::string_view offsetStr(roData + size - 9, 8);
  roDataOffset = hexStr2Int(offsetStr);
  roDataEnd = roDataOffset + size;
  fprintf(stderr, "Opened rodata file '%s', size: %d, offset: %d\n", binFile.c_str(), size, roDataOffset);
}

// (A-Z, a-z, 0-9, symbols)
bool isValidAsciiChar(char c) {
  return c >= 'A' && c <= '~';
}
bool isAddressInRoData(unsigned int address) {
  return address >= roDataOffset && address < roDataEnd;
}
bool isValidRoDataStrAddr(unsigned int address) {
  if (!isAddressInRoData(address + 1)) {
    return false;
  }
  auto bufferOffset = address - roDataOffset;
  auto c = roData[bufferOffset];
  return isValidAsciiChar(c);
}

// Get a null-terminated string from the rodata section
std::string getRoDataStringNT(unsigned int offset) {
  if (!isValidRoDataStrAddr(offset)) {
    return "";
  }
  auto bufferOffset = offset - roDataOffset;
  int len = 0;
  while (isAddressInRoData(offset + len) && roData[bufferOffset + len] != '\0') {
    len++;
  }
  return std::string(roData + bufferOffset, len);
}
float getRoDataFloat(unsigned int offset) {
  if (!isAddressInRoData(offset)) {
    return -0.0f;
  }
  auto bufferOffset = offset - roDataOffset;
  return *(float *)(roData + bufferOffset);
}
std::string getRoDataHexDump(unsigned int offset, int len) {
  if (!isAddressInRoData(offset)) {
    return "";
  }
  auto bufferOffset = offset - roDataOffset;
  std::string hexDump;
  for (int i = 0; i < len; i++) {
    char c = roData[bufferOffset + i];
    char buffer[4];
    snprintf(buffer, 4, "%02x", c);
    hexDump += buffer;
  }
  return hexDump;
}
std::string fnv64Hex(std::string_view str) {
  unsigned long long hash = 0xcbf29ce484222325;
  for (size_t i = 0; i < str.size(); i++) {
    hash *= 0x100000001b3;
    hash ^= str[i];
  }
  char buffer[17];
  snprintf(buffer, 17, "%016llx", hash);
  return "0x" + std::string(buffer);
}

struct CurrentBlockData {
  std::string blockName;
  std::string blockClass;
  unsigned int breakTimeAddr;
  std::vector<std::string> stateKeys;
};
std::vector<CurrentBlockData> blockData;

bool hasSeenBlockClass(const std::string_view &blockClass) {
  for (auto &block : blockData) {
    if (block.blockClass == blockClass) {
      return true;
    }
  }
  return false;
}

bool contains(const std::vector<std::string> &vec, const std::string &str) {
  return std::find(vec.begin(), vec.end(), str) != vec.end();
}

void loadDisassembly(std::string filePath) {
  // *uses AT&T syntax ; too late to change now
  std::istream *disStream = &std::cin;
  if (!filePath.empty()) {
    disStream = new std::ifstream(filePath, std::ios::binary);
    if (!((std::ifstream *)disStream)->is_open()) {
      std::cerr << "Failed to open file: " << filePath << std::endl;
      return;
    }
  }

  // 64KB buffer
  const int bufferSize = 1024 * 64;
  char buffer[bufferSize];
  std::string trackingBlock;
  std::string trackingState;
  bool isInGlobalBlock = false;
  bool isInBlockRegistry = false;

  std::string inStateSerializer;
  std::map<std::string, std::vector<std::string>> stateEntries;

  unsigned int lastLastLoadedAddress;
  unsigned int lastLoadedAddress;
  std::string lastLoadedAddressAbsMovStr;

  std::optional<CurrentBlockData> currentBlockData;

  std::vector<std::string> seenBlockIds;
  std::vector<std::string> seenConstants;
  // std::vector<std::string> seenStates;

  Instruction instr;

  while (disStream->getline(buffer, bufferSize)) {
    parseAttLine(buffer, instr);
    if (instr.type == NO_INSTR) {
      goto finish;
    }
    registerProcessInstruction(instr);

    // movabs $0x116b2c0, %rbx -> move the address to rbx
    if (instr.type == MOVABS) {
      std::string_view line(buffer);
      size_t pos = line.find("$");
      size_t endPos = line.find(",");
      if (pos != std::string::npos && endPos != std::string::npos) {
        auto loadedStr = line.substr(pos + 1, endPos - pos - 1);
        lastLoadedAddressAbsMovStr = loadedStr;

        // B1. if we are tracking a block, then print the constant
        if (!trackingBlock.empty()) {
          // if line includes '#', then split by the comment and get the comment
          if (isValidRoDataStrAddr(lastLoadedAddress)) {
            std::string str = getRoDataStringNT(lastLoadedAddress);
            std::cout << "BlockID\t" << trackingBlock << "\t" << loadedStr << "\t" << str << std::endl;
            seenBlockIds.push_back(trackingBlock);
          }
        }
      }
    }

    if (instr.type == CALL) {
      std::string_view line(buffer);
      size_t pos = line.find("registerBlock<");
      if (pos != std::string::npos) {
        if (currentBlockData.has_value()) {
          blockData.push_back(currentBlockData.value());
          currentBlockData.reset();
        }

        // class name is between "registerBlock<" and ","
        size_t classStart = pos;
        size_t classEnd = line.find(",", classStart);
        auto blockClass = line.substr(classStart + 14, classEnd - classStart - 14);
        if (trackingBlock.empty()) {
          if (!hasSeenBlockClass(blockClass)) {
            std::cerr << "? Unloaded Block registration: " << line << std::endl;
          }
        } else {
          currentBlockData = CurrentBlockData{.blockName = trackingBlock, .blockClass = std::string(blockClass)};
        }
      }

      size_t addStatePos = line.find("::addState(BlockState");
      if (addStatePos != std::string::npos) {
        if (currentBlockData.has_value()) {
          auto arg2 = registerGetArgInt(1);
          if (arg2.symbolValue[0] && !contains(currentBlockData->stateKeys, arg2.symbolValue)) {
            // VanillaStates::UpdateBit
            auto symbol = std::string(arg2.symbolValue);
            size_t statePos = symbol.find("::");
            if (statePos != std::string::npos) {
              auto stateName = symbol.substr(statePos + 2);
              if (stateName.find("::") != std::string::npos) {
                stateName = stateName.substr(stateName.find("::") + 2);
              }
              currentBlockData->stateKeys.push_back(stateName);
            }
          }
        }
      }

      if (currentBlockData.has_value()) {
        //  74061b8:	callq  6bd9f60 <BlockLegacy::setDestroyTime(float, float)>
        size_t destroyPos = line.find("setDestroyTime");
        if (destroyPos != std::string::npos) {
          if (line.find(", float") != std::string::npos) {
            // the last last loaded address is the address of the destroy time value
            currentBlockData->breakTimeAddr = lastLastLoadedAddress;
          } else {
            // the last loaded address is the address of the destroy time value
            currentBlockData->breakTimeAddr = lastLoadedAddress;
          }
        }
      }
    }

    if (instr.type == LEA) {
      std::string_view line(buffer);

      if (instr.commentSymbolStart && instr.commentSymbolEnd) {
        // there is a "# 86d4858 <VanillaBlockTypeIds::Air>" comment
        lastLastLoadedAddress = lastLoadedAddress;
        lastLoadedAddress = instr.commentAddr;

        if (inStateSerializer.size() > 0) {
          // we are interested in capturing all loaded constants inside the state serializer
          if (isValidRoDataStrAddr(instr.commentAddr)) {
            auto str = getRoDataStringNT(instr.commentAddr);
            stateEntries[inStateSerializer].push_back(str);
          }
        }

        size_t constPos = line.find("SharedConstants::");
        if (constPos != std::string::npos) {
          auto sharedName = line.substr(constPos + 17, line.size() - constPos - 18);
          auto sharedNameStr = std::string(sharedName);
          if (!contains(seenConstants, sharedNameStr)) {
            seenConstants.push_back(sharedNameStr);
            auto hexDump = getRoDataHexDump(instr.commentAddr, 32);
            std::cout << "Const\t" << sharedName << "\t" << instr.commentAddr << "\t" << hexDump << std::endl;
          }
        }

        size_t pos = line.find("VanillaBlockTypeIds::");
        if (pos != std::string::npos) {
          trackingBlock = line.substr(pos + 21, line.size() - pos - 22);
        }
      }
    } else {
      // B1. cont. Sometimes the movabs with hash is not after 2x lea ops, so we dump what we have and continue
      if (!trackingBlock.empty() && instr.type != MOVABS) {
        // If we've already seen the block, above check is not needed
        if (!contains(seenBlockIds, trackingBlock)) {
          // if line includes '#', then split by the comment and get the comment
          if (isValidRoDataStrAddr(lastLoadedAddress)) {
            auto str = getRoDataStringNT(lastLoadedAddress);
            std::cout << "BlockID\t" << trackingBlock << "\t" << "UNK" << "\t" << str << std::endl;
          }
        }
      }
      // lea/mov are both used to load args before a call, so we can keep tracking if it's also a mov
      if (instr.type != MOV) {
        trackingBlock.clear();
      }
    }

    // if a move over lea, we maybe loading block states
    if (instr.type == MOV) {
      std::string_view line(buffer);
      // if line includes '#', then split by the comment and get the comment
      if (instr.commentAddr) {
        if (isInBlockRegistry || currentBlockData.has_value()) {
          lastLastLoadedAddress = lastLoadedAddress;
          lastLoadedAddress = instr.commentAddr;
        } else if (isInGlobalBlock) {
          size_t statesPos = line.find("VanillaStates::");
          size_t altStatePos = line.find("BuiltInBlockStates::");
          // State Registration
          if ((statesPos != std::string::npos) || (altStatePos != std::string::npos)) {
            // ensure there's no + offset in the symbol
            if (line.find("+") != std::string::npos) {
              goto finish;
            }
            auto states = statesPos != std::string::npos ? line.substr(statesPos + 15, line.size() - statesPos - 16)
                                                         : line.substr(altStatePos, line.size() - altStatePos - 1);
            if (isValidRoDataStrAddr(lastLoadedAddress)) {
              auto str = getRoDataStringNT(lastLoadedAddress);
              auto computedHash = fnv64Hex(str); // lastLoadedAddressAbsMovStr can be optimized out
              std::cout << "VanillaState\t" << states << "\t" << computedHash << "\t" << str << std::endl;
            } else if (isValidRoDataStrAddr(lastLastLoadedAddress)) {
              auto str = getRoDataStringNT(lastLastLoadedAddress);
              auto computedHash = fnv64Hex(str);
              std::cout << "VanillaState\t" << states << "\t" << computedHash << "\t" << str << std::endl;
            } else {
              // std::cout << "? NOT adding VanillaState\t" << states << " " << lastLoadedAddress << "\t"
              //           << lastLoadedAddressAbsMovStr << std::endl;
            }
          }
        }
      }
    }

    // if buffer ends with a colon, then it's a new block
    if (instr.isFunctionStart) {
      std::string_view line(buffer);
      trackingBlock.clear();
      // globals initialization block
      if (line.find("_GLOBAL_") != std::string::npos) {
        isInGlobalBlock = true;
      } else {
        isInGlobalBlock = false;
      }
      if (line.find("::registerBlocks") != std::string::npos) {
        isInBlockRegistry = true;
      } else {
        isInBlockRegistry = false;
        if (currentBlockData.has_value()) {
          blockData.push_back(currentBlockData.value());
          currentBlockData.reset();
        }
      }

      // 000000000715d070 <bool StateSerializationUtils::fromNBT<VerticalHalfEnum>(Tag const&, int&)>:
      if (line.find("StateSerializationUtils::fromNBT<") != std::string::npos) {
        auto pos = line.find("StateSerializationUtils::fromNBT<");
        auto end = line.find(">", pos);
        auto substr = line.substr(pos + 33, end - pos - 33);
        inStateSerializer = std::string(substr);
      } else {
        inStateSerializer.clear();
      }
    }
  finish:
    ZeroMemory(buffer, bufferSize);
    clearInstruction(instr);
  }

  if (!filePath.empty()) {
    ((std::ifstream *)disStream)->close();
    delete disStream;
  }
  // Print out the block data
  for (auto &block : blockData) {
    auto flt = getRoDataFloat(block.breakTimeAddr);
    std::cout << "BlockData\t" << block.blockName << "\t" << block.blockClass << "\t" << flt << "\t";
    for (auto &state : block.stateKeys) {
      std::cout << state << ",";
    }
    std::cout << std::endl;
  }

  // Print out the state entries
  for (auto &entry : stateEntries) {
    std::cout << "StateEntry\t" << entry.first << "\t";
    for (auto &state : entry.second) {
      std::cout << state << ",";
    }
    std::cout << std::endl;
  }
}

// STAGE 2

// StateHash -> integer data for this state (like number of variants)
std::map<std::string, std::vector<unsigned int>> stateVariantMap;

void split4(std::string_view line, std::string &a, std::string &b, std::string &c, std::string &d) {
  size_t pos = line.find("\t");
  if (pos != std::string::npos) {
    a = std::string(line.substr(0, pos));
    size_t pos2 = line.find("\t", pos + 1);
    if (pos2 != std::string::npos) {
      b = std::string(line.substr(pos + 1, pos2 - pos - 1));
      size_t pos3 = line.find("\t", pos2 + 1);
      if (pos3 != std::string::npos) {
        c = std::string(line.substr(pos2 + 1, pos3 - pos2 - 1));
        d = std::string(line.substr(pos3 + 1, line.size() - pos3 - 1));
      } else {
        c = std::string(line.substr(pos2 + 1, line.size() - pos2 - 1));
      }
    }
  }
}

void loadStage1(std::string filePath) {
  // load stage1 which is the output of above loadDisassembly function
  std::ifstream stage1Stream(filePath, std::ios::binary);
  if (!stage1Stream.is_open()) {
    std::cerr << "Failed to open file: " << filePath << std::endl;
    return;
  }
  // split by tabs
  const int bufferSize = 1024 * 64;
  char buffer[bufferSize];
  while (stage1Stream.getline(buffer, bufferSize)) {
    std::string_view line(buffer);
    size_t pos = line.find("\t");
    if (pos != std::string::npos) {
      // VanillaState    StateID         StateHash                StateName
      // VanillaState    BiteCounter     0x6bcbbe2ee1f42f72      bite_counter
      // we are interested in the 2nd and 3rd columns
      std::string name, id, hash, stateName;
      split4(line, name, id, hash, stateName);
      if (name == "VanillaState") {
        // Strip the 0x prefix and leading zeros - not insignificant and disassembler may not include them
        while (hash.size() > 0 && (hash[0] == '0' || hash[0] == 'x')) {
          hash = hash.substr(1, hash.size() - 1);
        }
        stateVariantMap[hash] = {};
      }
    }
  }
  fprintf(stderr, "Loaded %lld state variants from stage1\n", stateVariantMap.size());
}

std::map<uint64_t, std::string> symbolMap;

void loadStage4(std::string filePath) {
  // load stage1 which is the output of above loadDisassembly function
  std::ifstream stage4Stream(filePath, std::ios::binary);
  if (!stage4Stream.is_open()) {
    std::cerr << "Failed to open file: " << filePath << std::endl;
    return;
  }
  // split by tabs
  const int bufferSize = 1024 * 64;
  char buffer[bufferSize];
  while (stage4Stream.getline(buffer, bufferSize)) {
    std::string_view line(buffer);
    size_t pos = line.find("\t");
    if (pos != std::string::npos) {
      // WSYM    Address         SymbolNams
      // WSYM    0x6bcbbe2ee1f42f72      BlockTrait::Something
      std::string name, address, symbolName, _;
      split4(line, name, address, symbolName, _);
      if (name == "WSYM") {
        uint64_t addressInt = hexStr2Int64(address);
        symbolMap[addressInt] = symbolName;
      }
    }
  }
  fprintf(stderr, "Loaded %lld symbols from stage4\n", symbolMap.size());
}

bool haveSymbolForAddress(std::string_view addressStr) {
  uint64_t addr = hexStr2Int64(addressStr);
  return symbolMap.find(addr) != symbolMap.end();
}

std::string getSymbolForAddress(std::string_view address) {
  return symbolMap[hexStr2Int64(address)];
}

void loadDisassembly2(std::string filePath) {
  std::istream *disStream = &std::cin;
  if (!filePath.empty()) {
    disStream = new std::ifstream(filePath, std::ios::binary);
    if (!((std::ifstream *)disStream)->is_open()) {
      std::cerr << "Failed to open file: " << filePath << std::endl;
      return;
    }
  }

  bool inStateVariant = false;
  std::string currentHash;

  const int bufferSize = 1024 * 64;
  char buffer[bufferSize]{0};

  std::string trackingBlock;
  // if trackingBlockFoundReg is > 0, we're tracking a block. We continue tracking for n instructions.
  int trackingBlockFoundReg = 0;

  bool inMovInstruction = false;
  //  140064b38:	48 c7 05 ad 7f 95 02 	mov    QWORD PTR [rip+0x2957fad],0x4        # 0x1429bcaf0
  while (disStream->getline(buffer, bufferSize)) {
    if (STR_STARTS_WITH4(&buffer[36], "mov ")) {
      inMovInstruction = true;
    } else if (buffer[36] != ' ' && buffer[36] != '\0') {
      // if the instruction is not a continuation of the previous instruction
      inMovInstruction = false;
    }

    // now we are looking for the state variants... first look for movabs
    if (STR_STARTS_WITH4(&buffer[36], "movabs")) {
      std::string_view line(buffer);

      for (auto &entry : stateVariantMap) {
        size_t pos = line.find(entry.first);
        if (pos != std::string::npos) {
          // we found the state hash, now we need to find the number of variants
          currentHash = entry.first;
        }
      }
    }

    if (STR_STARTS_WITH4(&buffer[36], "lea ")) {
      std::string_view line(buffer);
      size_t addressPos = line.find(" # ");
      if (addressPos != std::string::npos) {
        auto addressStr = line.substr(addressPos + 5);
        if (haveSymbolForAddress(addressStr)) {
          auto symbol = getSymbolForAddress(addressStr);
          size_t blockPos = symbol.find("VanillaBlockTypeIds::");
          if (blockPos != std::string::npos) {
            trackingBlock = symbol.substr(blockPos + 21);
            trackingBlockFoundReg = 0;
          }
        }
      }
    }

    if (STR_STARTS_WITH4(&buffer[36], "call")) {
      std::string_view line(buffer);
      auto addressIx = line.find("0x");
      if (addressIx != std::string::npos) {
        auto addressStr = line.substr(addressIx + 2);
        if (haveSymbolForAddress(addressStr)) {
          auto symbol = getSymbolForAddress(addressStr);
          if (trackingBlockFoundReg > 0) {
            size_t traitPos = symbol.find("BlockTrait::");
            if (traitPos != std::string::npos) {
              auto traitStr = symbol.substr(traitPos);
              std::cout << "BlockTrait\t" << trackingBlock << "\t" << symbol << std::endl;
            }
          }
          size_t pos = symbol.find("registerBlock<");
          if (pos != std::string::npos) {
            trackingBlockFoundReg = trackingBlock.empty() ? 0 : 40;
          }
        }
      }
    }

    if (trackingBlockFoundReg) {
      trackingBlockFoundReg--;
      if (trackingBlockFoundReg == 0)
        trackingBlock.clear();
    }

    //    140064b3f:	04 00 00 00
    if (inMovInstruction && buffer[36] == '\0' && currentHash.size() > 0) {
      // this instruction is not an instruction but a continuation of the previous mov instruction
      // this should contain the number of state variants
      std::string_view line(buffer);
      // split by the colon
      size_t pos = line.find(":");
      if (pos != std::string::npos) {
        auto hexStr = line.substr(pos + 1, line.size() - pos);
        unsigned int value = hexStr2IntLE(hexStr);
        stateVariantMap[currentHash].push_back(value);
        // max is 3 entries
        if (stateVariantMap[currentHash].size() == 3) {
          currentHash.clear();
        }
      }
    }

    ZeroMemory(buffer, bufferSize);
  }

  if (!filePath.empty()) {
    ((std::ifstream *)disStream)->close();
    delete disStream;
  }

  for (auto &entry : stateVariantMap) {
    auto hash = entry.first;
    // re-add the 0x and leading 0s
    while (hash.size() < 16) {
      hash = "0" + hash;
    }
    hash = "0x" + hash;
    std::cout << "StateVariantData\t" << hash << "\t";
    for (auto &value : entry.second) {
      std::cout << value << ",";
    }
    std::cout << std::endl;
  }
}

int main(int argc, char **argv) {
  if (argc < 3) {
    std::cerr << "Usage: disa -s1 <rodataFile> [dis]" << std::endl;
    std::cerr << "Usage: disa -s2 <stage1File> [dis]" << std::endl;
    return 1;
  }
  std::string stage = argv[1];
  std::string file = argv[2];
  std::string disFile;
  if (argc > 3) {
    disFile = argv[3];
  }
  std::cout << "Stage: " << stage << std::endl;
  if (disFile.empty()) {
    std::cerr << "(waiting for stdin)" << std::endl;
  }
  if (stage == "-s1") {
    loadRoData(file);
    loadDisassembly(disFile);
  } else if (stage == "-s2") {
    loadStage1(file);
    // Not yet implemented: trait data extraction. This will require re-ordering and running stage4 before doing stage2.
    // loadStage4("stage4.txt");
    loadDisassembly2(disFile);
  }
  std::cerr << "Done" << std::endl;
  return 0;
}
