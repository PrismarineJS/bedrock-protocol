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

std::map<unsigned int, std::string> stringsMap;
void loadStrings(std::string filePath) {
  // Load the strings file TSV into a map
  std::ifstream stringsStream(filePath, std::ios::binary);
  if (!stringsStream.is_open()) {
    std::cerr << "Failed to open file: " << filePath << std::endl;
    return;
  }
  const int bufferSize = 1024 * 64;
  char buffer[bufferSize];
  while (stringsStream.getline(buffer, bufferSize)) {
    std::string_view line(buffer);
    size_t pos = line.find('\t');
    if (pos != std::string::npos) {
      std::string_view key = line.substr(0, pos);
      std::string_view value = line.substr(pos + 1, line.size() - pos - 1);
      unsigned int keyInt = hexStr2Int(key);
      stringsMap[keyInt] = std::string(value);
    }
  }
  stringsStream.close();
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

  while (disStream->getline(buffer, bufferSize)) {
    // movabs $0x116b2c0, %rbx -> move the address to rbx
    if (buffer[10] == 'm' && buffer[11] == 'o' && buffer[12] == 'v' && buffer[13] == 'a' && buffer[14] == 'b' &&
        buffer[15] == 's') {
      std::string_view line(buffer);
      size_t pos = line.find("$");
      size_t endPos = line.find(",");
      if (pos != std::string::npos && endPos != std::string::npos) {
        auto addressStr = line.substr(pos + 1, endPos - pos - 1);
        lastLoadedAddressAbsMovStr = addressStr;
        // auto addressInt = hexStr2Int(addressStr);

        // B1. if we are tracking a block, then print the constant
        if (!trackingBlock.empty()) {
          // if line includes '#', then split by the comment and get the comment
          if (stringsMap.find(lastLoadedAddress) != stringsMap.end()) {
            std::cout << "BlockID\t" << trackingBlock << "\t" << addressStr << "\t" << stringsMap[lastLoadedAddress]
                      << std::endl;
            seenBlockIds.push_back(trackingBlock);
          }
        }
      }
    }

    // callq  745ef90 <DirtBlock& BlockTypeRegistry::registerBlock<DirtBlock, int>(HashedString const&, int&&)>
    if (buffer[10] == 'c' && buffer[11] == 'a' && buffer[12] == 'l' && buffer[13] == 'l') {
      std::string_view line(buffer);

      // if line contains registerBlock, then it's a block registration
      size_t registerPos = line.find("registerBlock<");
      if (registerPos != std::string::npos) {
        if (currentBlockData.has_value()) {
          blockData.push_back(currentBlockData.value());
          currentBlockData.reset();
        }

        // class name is between "registerBlock<" and ","
        size_t classStart = registerPos;
        size_t classEnd = line.find(",", classStart);
        auto blockClass = line.substr(classStart + 14, classEnd - classStart - 14);
        if (trackingBlock.empty()) {
          if (!hasSeenBlockClass(blockClass)) {
            std::cerr << "? Unloaded Block registration: " << line << std::endl;
          }
        } else {
          currentBlockData = CurrentBlockData{.blockClass = std::string(blockClass)};
          // std::cout << "BlockRegistration\t" << trackingBlock << "\t" << blockClass << std::endl;
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

    if (buffer[10] == 'l' && buffer[11] == 'e' && buffer[12] == 'a') {
      std::string_view line(buffer);

      size_t pos = line.find("#");
      if (pos != std::string::npos) {
        auto comment = line.substr(pos + 2, line.size() - pos - 1);
        // above bounds to skip the comment+space
        // split the comment by the first space
        auto addressPos = comment.find(" ");
        if (addressPos != std::string::npos) {
          auto addressStr = comment.substr(0, addressPos);
          auto addressInt = hexStr2Int(addressStr);

          lastLastLoadedAddress = lastLoadedAddress;
          lastLoadedAddress = addressInt;

          if (inStateSerializer.size() > 0) {
            // we are interested in capturing all loaded constants inside the state serializer
            if (stringsMap.find(addressInt) != stringsMap.end()) {
              stateEntries[inStateSerializer].push_back(stringsMap[addressInt]);
            }
          }

          size_t constPos = line.find("SharedConstants::");
          if (constPos != std::string::npos) {
            auto sharedName = line.substr(constPos + 17, line.size() - constPos - 18);
            auto sharedNameStr = std::string(sharedName);
            if (!contains(seenConstants, sharedNameStr)) {
              seenConstants.push_back(sharedNameStr);
              std::cout << "Const\t" << sharedName << "\t" << addressStr << std::endl;
            }
          }
        }

        size_t pos = line.find("VanillaBlockTypeIds::");
        if (pos != std::string::npos) {
          trackingBlock = line.substr(pos + 21, line.size() - pos - 22);
          // std::cout << "Now tracking: " << trackingBlock << "- " << line << std::endl;
        }

        if (currentBlockData.has_value()) {
          //  758eaa3:	lea    0x1145dae(%rip),%rsi        # 86d4858 <VanillaStates::UpdateBit>
          size_t statesPos = line.find("VanillaStates::");
          if (statesPos != std::string::npos) {
            // ensure there's no + in the symbol
            if (comment.find("+") != std::string::npos) {
              continue;
            }
            auto end = comment.find(">");
            auto states = line.substr(statesPos + 15, line.size() - statesPos - 16);
            auto statesStr = std::string(states);
            currentBlockData->stateKeys.push_back(statesStr);
          }
        }
      }
    } else {
      // B1. cont. Sometimes the movabs with hash is not after 2x lea ops, so we dump what we have and continue
      if (!trackingBlock.empty() && !(buffer[10] == 'm' && buffer[11] == 'o' && buffer[12] == 'v' &&
                                      buffer[13] == 'a' && buffer[14] == 'b' && buffer[15] == 's')) {
        // If we've already seen the block, above check is not needed
        if (!contains(seenBlockIds, trackingBlock)) {
          // if line includes '#', then split by the comment and get the comment
          if (stringsMap.find(lastLoadedAddress) != stringsMap.end()) {
            std::cout << "BlockID\t" << trackingBlock << "\t" << "UNK" << "\t" << stringsMap[lastLoadedAddress]
                      << std::endl;
          }
        }
      }
      // lea/mov are both used to load constants before a call, so we can keep tracking if it's also a mov
      if (!(buffer[10] == 'm' && buffer[11] == 'o' && buffer[12] == 'v')) {
        trackingBlock.clear();
      }
    }

    // if a move over lea, we maybe loading block states
    if (buffer[10] == 'm' && buffer[11] == 'o' && buffer[12] == 'v') {
      std::string_view line(buffer);
      // if line includes '#', then split by the comment and get the comment
      size_t pos = line.find("#");
      if (pos != std::string::npos) {
        auto comment = line.substr(pos + 2, line.size() - pos - 1);

        // Some reason some blocks are loaded outside of the block registry
        if (isInBlockRegistry || currentBlockData.has_value()) {
          auto addressPos = comment.find(" ");
          if (addressPos != std::string::npos) {
            auto addressStr = comment.substr(0, addressPos);
            auto addressInt = hexStr2Int(addressStr);
            lastLastLoadedAddress = lastLoadedAddress;
            lastLoadedAddress = addressInt;
          }
        } else if (isInGlobalBlock) {
          // State Registration?
          auto statesPos = comment.find("VanillaStates::");
          if (statesPos != std::string::npos) {
            // ensure there's no + in the symbol
            if (comment.find("+") != std::string::npos) {
              continue;
            }
            auto states = comment.substr(statesPos + 15, comment.size() - statesPos - 16);
            if (stringsMap.find(lastLoadedAddress) != stringsMap.end()) {
              std::cout << "VanillaState\t" << states << "\t" << lastLoadedAddressAbsMovStr << "\t"
                        << stringsMap[lastLoadedAddress] << std::endl;
            } else if (stringsMap.find(lastLastLoadedAddress) != stringsMap.end()) {
              // try once more but with the last last loaded address...
              // this can happen if another LEA code is between
              std::cout << "VanillaState\t" << states << "\t" << lastLoadedAddressAbsMovStr << "\t"
                        << stringsMap[lastLastLoadedAddress] << std::endl;
            } else {
              // std::cout << "? NOT adding VanillaState\t" << states << " " << lastLoadedAddress << "\t"
              //           << lastLoadedAddressAbsMovStr << std::endl;
            }
          }
        }
      }
    }

    // if buffer ends with a colon, then it's a new block
    if (buffer[0] == '0') {
      std::string_view line(buffer);
      trackingBlock.clear();
      // globals initialization
      if (line.find("<_GLOBAL_") != std::string::npos) {
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
        // std::cout << "StateSerializer\t" << substr << std::endl;
        inStateSerializer = std::string(substr);
      } else {
        inStateSerializer.clear();
      }
    }
    ZeroMemory(buffer, bufferSize);
  }

  if (!filePath.empty()) {
    ((std::ifstream *)disStream)->close();
    delete disStream;
  }

  // Print out the block data
  for (auto &block : blockData) {
    std::cout << "BlockData\t" << block.blockName << "\t" << block.blockClass << "\t" << block.breakTimeAddr << "\t";
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
    std::cout << "StateVariantData\t" << entry.first << "\t";
    for (auto &value : entry.second) {
      std::cout << value << ",";
    }
    std::cout << std::endl;
  }
}

int main(int argc, char **argv) {
  if (argc < 3) {
    std::cerr << "Usage: disa -s1 <stringsFile> [dis]" << std::endl;
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
    loadStrings(file);
    loadDisassembly(disFile);
  } else if (stage == "-s2") {
    loadStage1(file);
    loadDisassembly2(disFile);
  }
  return 0;
}
