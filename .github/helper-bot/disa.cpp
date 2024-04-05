#include <fstream>
#include <iostream>
#include <map>
#include <optional>
#include <string>
#include <string_view>
#include <vector>
#include <algorithm>

void ZeroMemory(char *buffer, int size) {
  for (int i = 0; i < size; i++) {
    buffer[i] = 0;
  }
}

unsigned int hexStr2Int(const std::string_view &hexStr) {
  const char *hexStrC = hexStr.data();
  unsigned int value = 0;
  for (size_t i = 0; i < hexStr.size(); i++) {
    char c = hexStrC[i];
    if (c >= '0' && c <= '9') {
      value = (value << 4) + (c - '0');
    } else if (c >= 'a' && c <= 'f') {
      value = (value << 4) + (c - 'a' + 10);
    } else if (c >= 'A' && c <= 'F') {
      value = (value << 4) + (c - 'A' + 10);
    }
  }
  return value;
}

unsigned int hexStr2IntLE(const std::string_view &hexStr) {
  unsigned int value = hexStr2Int(hexStr);
  unsigned int swapped = ((value >> 24) & 0xff) |      // move byte 3 to byte 0
                         ((value << 8) & 0xff0000) |   // move byte 1 to byte 2
                         ((value >> 8) & 0xff00) |     // move byte 2 to byte 1
                         ((value << 24) & 0xff000000); // byte 0 to byte 3
  return swapped;
}

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
bool isValidAsciiChar(char c) { return c >= 'A' && c <= '~'; }
bool isAddressInRoData(unsigned int address) { return address >= roDataOffset && address < roDataEnd; }
bool isValidRoDataStrAddr(unsigned int address) {
  if (!isAddressInRoData(address + 1)) {
    return false;
  }
  auto bufferOffset = address - roDataOffset;
  auto c = roData[bufferOffset];
  // Check that c is an ASCII char
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

//
//  708c23b:	lea    0x1647ede(%rip),%rsi        # 86d4120 <VanillaStates::Height>
enum InstructionType { NO_INSTR, MOVABS, MOV, LEA, CALL, OTHER, FUNCTION_START };
struct Instruction {
  InstructionType type;
  bool isFunctionStart;
  char *asciiAddressStart;
  char *asciiAddressEnd;
  char *asciiOpStart;
  char *asciiOpEnd;
  char *asciiOperandsStart;
  char *asciiOperandsEnd;
  char *asciiCommentStart;
  char *asciiCommentEnd;
  unsigned int commentAddr;
  char *commentSymbolStart;
  char *commentSymbolEnd;
};
void clearInstruction(Instruction &instr) {
  instr.type = NO_INSTR;
  instr.isFunctionStart = false;
  instr.asciiAddressStart = nullptr;
  instr.asciiAddressEnd = nullptr;
  instr.asciiOpStart = nullptr;
  instr.asciiOpEnd = nullptr;
  instr.asciiOperandsStart = nullptr;
  instr.asciiOperandsEnd = nullptr;
  instr.asciiCommentStart = nullptr;
  instr.asciiCommentEnd = nullptr;
  instr.commentAddr = 0;
  instr.commentSymbolStart = nullptr;
  instr.commentSymbolEnd = nullptr;
}
void parseAttLine(char *buffer, Instruction &instr) {
  instr.asciiAddressStart = buffer;
  if (buffer[0] == ' ') {
    instr.isFunctionStart = false;
  } else {
    instr.isFunctionStart = true;
  }

  if (instr.isFunctionStart) {
    // 0000000002c44530 <deregister_tm_clones>:
    bool readingAddress = true;
    bool readingSymbol = false;
    int i = 0;
    for (;; i++) {
      auto c = buffer[i];
      if (c == '\0')
        break;
      if (c == ' ' || c == '\t') {
        if (readingAddress) {
          readingAddress = false;
          readingSymbol = true;
          instr.asciiAddressEnd = buffer + i;
          instr.asciiOpStart = buffer + i + 1;
        }
      }
    }
    instr.asciiOpEnd = buffer + i;
    // op end here holds the symbol name
    // remove the colon
    instr.asciiOpEnd--;
  } else {
    bool readingAddress = true;
    bool readingOp = false;
    bool readingOperands = false;
    bool readingComment = false;
    for (int i = 0; true; i++) {
      auto c = buffer[i];
      if (c == '\0')
        break;

      if (readingAddress) {
        for (int j = i; true; j++) {
          auto c = buffer[j];
          if (c == '\0')
            break;
          if (c == ':') {
            readingAddress = false;
            readingOp = true;
            instr.asciiAddressEnd = buffer + j;
            i = j;
            break;
          }
        }
      } else if (readingOp) {
        for (int j = i; true; j++) {
          auto c = buffer[j];
          if (c == '\0')
            break;
          if (c == ' ' || c == '\t') {
            if (instr.asciiOpStart) {
              readingOp = false;
              readingOperands = true;
              instr.asciiOpEnd = buffer + j;
              i = j;
              break;
            }
          } else if (!instr.asciiOpStart) {
            instr.asciiOpStart = buffer + j;
          }
        }
      } else if (readingOperands) {
        for (int j = i; true; j++) {
          auto c = buffer[j];
          if (c == '#' || c == '\0') {
            readingOperands = false;
            readingComment = true;
            instr.asciiOperandsEnd = buffer + j;
            i = j;
            break;
          } else if (!(c == ' ' || c == '\t')) {
            if (!instr.asciiOperandsStart) {
              instr.asciiOperandsStart = buffer + j;
            }
          }
        }
      } else if (readingComment) {
        for (int j = i; true; j++) {
          auto c = buffer[j];
          if (c == '\0') {
            readingComment = false;
            instr.asciiCommentEnd = buffer + j;
            i = j;
            break;
          } else if (!instr.asciiCommentStart) {
            instr.asciiCommentStart = buffer + j;
          }
        }
      }
    }
  }

  // Sanity check: make sure we have at least an op start and end (this also covers functions)
  if (!instr.asciiOpStart || !instr.asciiOpEnd) {
    instr.type = NO_INSTR;
    instr.isFunctionStart = false;
    return;
  }

  if (instr.isFunctionStart) {
    instr.type = FUNCTION_START;
    return;
  }

  auto op = instr.asciiOpStart;
  if (op[0] == 'm' && op[1] == 'o' && op[2] == 'v' && op[3] == 'a' && op[4] == 'b' && op[5] == 's') {
    instr.type = MOVABS;
  } else if (op[0] == 'm' && op[1] == 'o' && op[2] == 'v') {
    instr.type = MOV;
  } else if (op[0] == 'l' && op[1] == 'e' && op[2] == 'a') {
    instr.type = LEA;
  } else if (op[0] == 'c' && op[1] == 'a' && op[2] == 'l' && op[3] == 'l') {
    instr.type = CALL;
  } else {
    instr.type = OTHER;
  }

  if (instr.asciiCommentStart && instr.asciiCommentEnd) {
    // Comment Start: [ 86d4120 <VanillaStates::Height>]
    // Comment End: []
    // iterate until the first '<' and then until the first '>'
    char *asciiCommentAddrStart = instr.asciiCommentStart + 1;
    char *asciiCommentAddrEnd = nullptr;
    char *asciiCommentSymbolStart = nullptr;
    char *asciiCommentSymbolEnd = nullptr;
    for (int i = 0; true; i++) {
      auto c = asciiCommentAddrStart[i];
      if (c == '\0')
        break;
      if (c == '<' && !asciiCommentAddrEnd) {
        asciiCommentAddrEnd = asciiCommentAddrStart + i;
        asciiCommentSymbolStart = asciiCommentAddrStart + i + 1;
      } else if (c == '>') {
        asciiCommentSymbolEnd = asciiCommentAddrStart + i;
        break;
      }
    }
    if (asciiCommentAddrEnd && asciiCommentSymbolStart && asciiCommentSymbolEnd) {
      instr.commentAddr =
          hexStr2Int(std::string_view(asciiCommentAddrStart, asciiCommentAddrEnd - asciiCommentAddrStart));
      instr.commentSymbolStart = asciiCommentSymbolStart;
      instr.commentSymbolEnd = asciiCommentSymbolEnd;
    }
  }
}
//

// void parseIntelLine() {}

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
          currentBlockData = CurrentBlockData{.blockClass = std::string(blockClass)};
          currentBlockData->blockName = trackingBlock;
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
            std::cout << "Const\t" << sharedName << "\t" << instr.commentAddr << std::endl;
          }
        }

        size_t pos = line.find("VanillaBlockTypeIds::");
        if (pos != std::string::npos) {
          trackingBlock = line.substr(pos + 21, line.size() - pos - 22);
        }

        if (currentBlockData.has_value()) {
          //  758eaa3:	lea    0x1145dae(%rip),%rsi        # 86d4858 <VanillaStates::UpdateBit>
          size_t statesPos = line.find("VanillaStates::");
          if (statesPos != std::string::npos) {
            // ensure there's no + in the symbol
            if (line.find("+") != std::string::npos) {
              continue;
            }
            auto end = line.find(">");
            auto states = line.substr(statesPos + 15, line.size() - statesPos - 16);
            auto statesStr = std::string(states);
            currentBlockData->stateKeys.push_back(statesStr);
          }
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
      // lea/mov are both used to load constants before a call, so we can keep tracking if it's also a mov
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
          // State Registration?
          size_t statesPos = line.find("VanillaStates::");
          if (statesPos != std::string::npos) {
            // ensure there's no + in the symbol
            if (line.find("+") != std::string::npos) {
              goto finish;
            }
            auto states = line.substr(statesPos + 15, line.size() - statesPos - 16);
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
      // globals initialization
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

  bool inMovInstruction = false;
  //  140064b38:	48 c7 05 ad 7f 95 02 	mov    QWORD PTR [rip+0x2957fad],0x4        # 0x1429bcaf0
  while (disStream->getline(buffer, bufferSize)) {
    if (buffer[36] == 'm' && buffer[37] == 'o' && buffer[38] == 'v' && buffer[39] == ' ') {
      inMovInstruction = true;
    } else if (buffer[36] != ' ' && buffer[36] != '\0') {
      // if the instruction is not a continuation of the previous instruction
      inMovInstruction = false;
    }
    // now we are looking for the state variants... first look for movabs
    if (buffer[36] == 'm' && buffer[37] == 'o' && buffer[38] == 'v' && buffer[39] == 'a' && buffer[40] == 'b' &&
        buffer[41] == 's') {
      std::string_view line(buffer);

      for (auto &entry : stateVariantMap) {
        size_t pos = line.find(entry.first);
        if (pos != std::string::npos) {
          // we found the state hash, now we need to find the number of variants
          currentHash = entry.first;
        }
      }
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
    std::cout << "(waiting for stdin)" << std::endl;
  }
  if (stage == "-s1") {
    loadRoData(file);
    loadDisassembly(disFile);
  } else if (stage == "-s2") {
    loadStage1(file);
    loadDisassembly2(disFile);
  }
  printf("Done\n");
  std::cerr << "Done" << std::endl;
  return 0;
}
