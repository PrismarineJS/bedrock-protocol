#include <iostream>
#include <string>
#include <sstream>
#include <stdint.h>
#include <llvm/Demangle/Demangle.h>

void readVanillaState(std::string &demangled) {
  auto vanillaStatesPos = demangled.find("VanillaStates::");
  if (vanillaStatesPos == std::string::npos) {
    return;
  }
  auto vanillaStateName = demangled.substr(vanillaStatesPos + 15);
  if (demangled.find("Variant<int>") != std::string::npos) {
    std::cout << "VST\t" << vanillaStateName << "\t" << "int" << std::endl;
  } else if (demangled.find("Variant<bool>") != std::string::npos) {
    std::cout << "VST\t" << vanillaStateName << "\t" << "bool" << std::endl;
  } else {
    // Capture what's in the Variant<...>
    auto variantPos = demangled.find("Variant<");
    if (variantPos != std::string::npos) {
      auto variantEndPos = demangled.find(">", variantPos);
      auto variantType = demangled.substr(variantPos + 8, variantEndPos - variantPos - 8);
      std::cout << "VST\t" << vanillaStateName << "\t" << "string" << "\t" << variantType << std::endl;
    } else {
      std::cout << "VST\t" << vanillaStateName << "\t" << "string" << std::endl;
    }
  }
}

void readConstant(std::string &demangled) {
  // enum CodeBuilder::ProtocolVersion const SharedConstants::CodeBuilderProtocolVersion
  auto sharedPos = demangled.find("SharedConstants::");
  if (sharedPos == std::string::npos) {
    return;
  }
  auto sharedName = demangled.substr(sharedPos + 17);
  auto type = demangled.substr(0, sharedPos - 1);
  std::cout << "SCT\t" << sharedName << "\t" << type << std::endl;
}

unsigned int parseInt(const std::string &str) {
  unsigned int result = 0;
  for (auto c : str) {
    result = result * 10 + (c - '0');
  }
  return result;
}

std::string int2hex(uint64_t i) {
  std::stringstream stream;
  stream << std::hex << i;
  return stream.str();
}

uint64_t hex2int(const std::string &hex) {
  uint64_t result = 0;
  for (auto c : hex) {
    result = result * 16 + (c >= '0' && c <= '9' ? c - '0' : c - 'a' + 10);
  }
  return result;
}

int find(std::string &what, std::string subStr) {
  for (int i = 0; i < what.size(); i++) {
    if (what[i] == subStr[0]) {
      bool found = true;
      for (int j = 1; j < subStr.size(); j++) {
        if (what[i + j] != subStr[j]) {
          found = false;
          break;
        }
      }
      if (found) {
        return i;
      }
    }
  }
  return -1;
}

#define STR_INCLUDES(haystack, needle) (haystack.find(needle) != std::string::npos)

void loadDump(uint64_t textOffset = 0x140001000, uint64_t relocOffset = 0x142bbd000) {
  uint64_t newOffset = relocOffset + 0x4A0000;
  std::string line;
  std::string readingBlockTrait;

  while (std::getline(std::cin, line)) {
    if (readingBlockTrait.size() > 0) {
      //  flags = function, addr = 0001:30564736
      auto symInfo = line.find("addr = ");
      if (symInfo != std::string::npos) {
        auto addr = line.find(":");
        if (addr != std::string::npos) {
          auto sectionId = line[addr - 1];
          auto addrStr = line.substr(addr + 1);
          if (sectionId == '1') { // .text
            uint64_t addrInt = parseInt(addrStr) + textOffset;
            std::cout << "WSYM\t" << int2hex(addrInt) << "\t" << readingBlockTrait << std::endl;
          } else if (sectionId == '3') { // .data
            uint64_t addrInt = parseInt(addrStr) + newOffset;
            std::cout << "WSYM\t" << int2hex(addrInt) << "\t" << readingBlockTrait << std::endl;
          }
        }
      }
      readingBlockTrait = "";
    }

    auto pos = line.find("`?");
    if (pos != std::string::npos) {
      std::string mangledName = line.substr(pos + 1, line.size() - pos - 2);
      std::string demangled = llvm::demangle(mangledName);

      if (mangledName.find("VanillaStates") != std::string::npos) {
        readVanillaState(demangled);
      } else if (mangledName.find("SharedConstants") != std::string::npos) {
        readConstant(demangled);
      }
      if (STR_INCLUDES(line, "S_PUB32")) {
        // Record only on the interesting things
        if (STR_INCLUDES(line, "BlockTrait") || STR_INCLUDES(line, "VanillaBlockTypeIds") ||
            STR_INCLUDES(line, "registerBlock")) {
          readingBlockTrait = demangled;
        }
      }
    }
  }
  printf("Done\n");
}

// 0 .text         022692fc  0000000140001000  0000000140001000  00000400  2**4

int main(int argc, char **argv) {
  if (argc < 3) {
    std::cerr << "Usage: " << argv[0] << " <textOffset> <relocOffset>" << std::endl;
    return 1;
  }
  std::string textOffsetStr = argv[1];
  std::string relocOffsetStr = argv[2];
  std::cerr << "textOffset: " << textOffsetStr << std::endl;
  std::cerr << "relocOffset: " << relocOffsetStr << std::endl;
  uint64_t textOffset = std::stol(textOffsetStr, nullptr, 16);
  uint64_t relocOffset = std::stol(relocOffsetStr, nullptr, 16);
  loadDump(textOffset, relocOffset);
  return 0;
}
