#include <iostream>
#include <string>
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

void loadDump() {
  std::string line;
  while (std::getline(std::cin, line)) {
    auto pos = line.find("`?");
    if (pos != std::string::npos) {
      std::string mangledName = line.substr(pos + 1, line.size() - pos - 2);
      std::string demangled = llvm::demangle(mangledName);

      if (mangledName.find("VanillaStates") != std::string::npos) {
        readVanillaState(demangled);
      } else if (mangledName.find("SharedConstants") != std::string::npos) {
        readConstant(demangled);
      }
    }
  }
}

/*
char *microsoftDemangle(const char *mangled_name, size_t *n_read, char *buf,
                        size_t *n_buf, int *status,
                        MSDemangleFlags Flags = MSDF_None);
*/

int main() {
  loadDump();
  return 0;
}
