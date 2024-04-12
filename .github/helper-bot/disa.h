#include <stdio.h>
#include <stdint.h>
#include <iostream>
#include <string>
#include <vector>

// clang-format off
#define STR_STARTS_WITH2(str, other) ((str)[0] == other[0] && (str)[1] == other[1])
#define STR_STARTS_WITH3(str, other) ((str)[0] == other[0] && (str)[1] == other[1] && str[2] == other[2])
#define STR_STARTS_WITH4(s, o) ((s)[0] == o[0] && (s)[1] == o[1] && (s)[2] == o[2] && (s)[3] == o[3])
#define STR_STARTS_WITH5(s, o) ((s)[0] == o[0] && (s)[1] == o[1] && (s)[2] == o[2] && (s)[3] == o[3] && (s)[4] == o[4])
#define STR_STARTS_WITH6(s, o) ((s)[0] == o[0] && (s)[1] == o[1] && (s)[2] == o[2] && (s)[3] == o[3] && (s)[4] == o[4] && (s)[5] == o[5])
#define STR_INCLUDES(haystack, needle) (haystack.find(needle) != std::string::npos)
// clang-format on

typedef unsigned long long int u64;

void ZeroMemory(char *buffer, int size) {
  for (int i = 0; i < size; i++) {
    buffer[i] = 0;
  }
}

void StringCopyInto(char *dest, const char *src) {
  while (*src) {
    *dest = *src;
    dest++;
    src++;
  }
  *dest = 0;
}
void StringCopyInto(char *dest, const char *src, int size, int max) {
  size = size < max ? size : max;
  ZeroMemory(dest, size);
  for (int i = 0; i < size; i++) {
    dest[i] = src[i];
  }
  dest[size] = 0;
}
void StringStartsWith(std::string_view &str, std::string_view &prefix) {
  if (str.size() < prefix.size()) {
    return;
  }
  for (size_t i = 0; i < prefix.size(); i++) {
    if (str[i] != prefix[i]) {
      return;
    }
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

u64 hexStr2Int64(const std::string_view &hexStr) {
  const char *hexStrC = hexStr.data();
  u64 value = 0;
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

// INSTR PARSE
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
    // op end here holds the symbol name
    instr.asciiOpEnd = buffer + i;
    // remove the trailing colon
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
void instructionReadOperands(Instruction &instr, std::string_view &a, std::string_view &b, std::string_view &c) {
  if (!instr.asciiOperandsStart || !instr.asciiOperandsEnd) {
    return;
  }
  std::string_view operand =
      std::string_view(instr.asciiOperandsStart, instr.asciiOperandsEnd - instr.asciiOperandsStart);

  // split by first comma
  size_t commaPos1 = operand.find(',');
  if (commaPos1 != std::string::npos) {
    a = operand.substr(0, commaPos1);
    std::string_view remaining = operand.substr(commaPos1 + 1);

    // split by second comma
    size_t commaPos2 = remaining.find(',');
    if (commaPos2 != std::string::npos) {
      b = remaining.substr(0, commaPos2);
      c = remaining.substr(commaPos2 + 1);
    } else {
      b = remaining;
    }
  } else {
    a = operand;
  }
}
// END INSTR PARSE

/*
rax - register a extended
rbx - register b extended
rcx - register c extended
rdx - register d extended
rbp - register base pointer (start of stack)
rsp - register stack pointer (current location in stack, growing downwards)
rsi - register source index (source for data copies)
rdi - register destination index (destination for data copies)
*/

const int MAX_SYMBOL_SIZE = 63;
union RegisterVal {
  enum RegisterDataType { RDTGeneric, RDTVanillaState, RDTBlockTypeID };
  u64 value;
  char symbolValue[MAX_SYMBOL_SIZE + 1];

  double doubleValue() {
    return value == 0 ? -0 : *(double *)&value;
  }
};
struct RegisterState {
  RegisterVal rax; //
  RegisterVal rbx; //
  RegisterVal rcx; // arg4
  RegisterVal rdx; // arg3
  RegisterVal rbp; // start of stack
  RegisterVal rsp; // current location in stack, growing downwards
  RegisterVal rsi; // register source index (source for data copies) ; arg2
  RegisterVal rdi; // register destination index (destination for data copies) ; arg1
  RegisterVal r8;
  RegisterVal r9;
  RegisterVal r10;
  RegisterVal r11;
  RegisterVal r12;
  RegisterVal r13;
  RegisterVal r14;
  RegisterVal r15;
  RegisterVal rip;
  RegisterVal rflags;
  RegisterVal xmm0;
  RegisterVal xmm1;
  RegisterVal xmm2;
  RegisterVal xmm3;
};
RegisterState g_registerState;
enum Register {
  REG_UNKNOWN,
  RAX,
  RBX,
  RCX,
  RDX,
  RBP,
  RSP,
  RSI,
  RDI,
  R8,
  R9,
  R10,
  R11,
  R12,
  R13,
  R14,
  R15,
  RIP,
  RFLAGS,
  XMM0,
  XMM1,
  XMM2,
  XMM3
};

void registerClearState() {
  g_registerState = RegisterState{};
}

Register registerGetType(std::string_view str) {
  // in AT&T syntax, registers are prefixed with %
  std::string_view reg = str[0] == '%' ? str.substr(1) : str;
  // std::cout << "Reading register: [" << reg << "]" << std::endl;
  // clang-format off
  if (STR_STARTS_WITH3(reg, "rax")) return RAX;
  if (STR_STARTS_WITH3(reg, "rbx")) return RBX;
  if (STR_STARTS_WITH3(reg, "rcx")) return RCX;
  if (STR_STARTS_WITH3(reg, "rdx")) return RDX;
  if (STR_STARTS_WITH3(reg, "rbp")) return RBP;
  if (STR_STARTS_WITH3(reg, "rsp")) return RSP;
  if (STR_STARTS_WITH3(reg, "rsi")) return RSI;
  if (STR_STARTS_WITH3(reg, "rdi")) return RDI;
  if (STR_STARTS_WITH2(reg, "r8")) return R8;
  if (STR_STARTS_WITH2(reg, "r9")) return R9;
  if (STR_STARTS_WITH3(reg, "r10")) return R10;
  if (STR_STARTS_WITH3(reg, "r11")) return R11;
  if (STR_STARTS_WITH3(reg, "r12")) return R12;
  if (STR_STARTS_WITH3(reg, "r13")) return R13;
  if (STR_STARTS_WITH3(reg, "r14")) return R14;
  if (STR_STARTS_WITH3(reg, "r15")) return R15;
  if (STR_STARTS_WITH3(reg, "rip")) return RIP;
  if (STR_STARTS_WITH5(reg, "rflag")) return RFLAGS;
  if (STR_STARTS_WITH4(reg, "xmm0")) return XMM0;
  if (STR_STARTS_WITH4(reg, "xmm1")) return XMM1;
  if (STR_STARTS_WITH4(reg, "xmm2")) return XMM2;
  if (STR_STARTS_WITH4(reg, "xmm3")) return XMM3;
  // clang-format on
  return REG_UNKNOWN;
}

// The first four integer or pointer parameters are passed in the first four general-purpose registers, rdi, rsi, rdx,
// and rcx. The first four floating-point parameters are passed in the first four SSE registers, xmm0-xmm3.
void registerSwap(RegisterVal &a, RegisterVal &b) {
  RegisterVal temp = a;
  a = b;
  b = temp;
}

RegisterVal registerGetArgFloat(int index) {
  switch (index) {
  case 0:
    return g_registerState.xmm0;
  case 1:
    return g_registerState.xmm1;
  case 2:
    return g_registerState.xmm2;
  case 3:
    return g_registerState.xmm3;
  default:
    return RegisterVal{};
  }
}

RegisterVal registerGetArgInt(int index) {
  switch (index) {
  case 0:
    return g_registerState.rdi;
  case 1:
    return g_registerState.rsi;
  case 2:
    return g_registerState.rdx;
  case 3:
    return g_registerState.rcx;
  default:
    return RegisterVal{};
  }
}

#define REG_CASE(U, L)                                                                                                 \
  case U: {                                                                                                            \
    /*std::cout << "Setting " << #L << " to " << value << std::endl;*/                                                 \
    g_registerState.L.value = value;                                                                                   \
    if (hasCommentSym)                                                                                                 \
      StringCopyInto(g_registerState.L.symbolValue, comment.data(), comment.size(), MAX_SYMBOL_SIZE);                  \
    return &g_registerState.L;                                                                                         \
  }

RegisterVal *registerSetVal(Register &reg, u64 value, bool hasCommentSym, std::string_view comment) {
  // std::cout << "Setting Register: " << reg << " to " << value << std::endl;
  switch (reg) {
    REG_CASE(RAX, rax)
    REG_CASE(RBX, rbx)
    REG_CASE(RCX, rcx)
    REG_CASE(RDX, rdx)
    REG_CASE(RBP, rbp)
    REG_CASE(RSP, rsp)
    REG_CASE(RSI, rsi)
    REG_CASE(RDI, rdi)
    REG_CASE(R8, r8)
    REG_CASE(R9, r9)
    REG_CASE(R10, r10)
    REG_CASE(R11, r11)
    REG_CASE(R12, r12)
    REG_CASE(R13, r13)
    REG_CASE(R14, r14)
    REG_CASE(R15, r15)
    REG_CASE(RIP, rip)
    REG_CASE(RFLAGS, rflags)
    REG_CASE(XMM0, xmm0)
    REG_CASE(XMM1, xmm1)
    REG_CASE(XMM2, xmm2)
    REG_CASE(XMM3, xmm3)
  default:
    break;
  }
  return nullptr;
}

#undef REG_CASE

void registerCopy(RegisterVal &a, RegisterVal &intoB) {
  // copy the value
  intoB.value = a.value;
  // copy the symbol
  StringCopyInto(intoB.symbolValue, a.symbolValue, MAX_SYMBOL_SIZE, MAX_SYMBOL_SIZE);
}

// clang-format off
#define REG_MOVE_CASE(UFROM, FROM) \
  case UFROM: \
    switch (intoRegSlot) { \
      case RAX: registerCopy(g_registerState.FROM, g_registerState.rax); return &g_registerState.rax; \
      case RBX: registerCopy(g_registerState.FROM, g_registerState.rbx); return &g_registerState.rbx; \
      case RCX: registerCopy(g_registerState.FROM, g_registerState.rcx); return &g_registerState.rcx; \
      case RDX: registerCopy(g_registerState.FROM, g_registerState.rdx); return &g_registerState.rdx; \
      case RBP: registerCopy(g_registerState.FROM, g_registerState.rbp); return &g_registerState.rbp; \
      case RSP: registerCopy(g_registerState.FROM, g_registerState.rsp); return &g_registerState.rsp; \
      case RSI: registerCopy(g_registerState.FROM, g_registerState.rsi); return &g_registerState.rsi; \
      case RDI: registerCopy(g_registerState.FROM, g_registerState.rdi); return &g_registerState.rdi; \
      case R8: registerCopy(g_registerState.FROM, g_registerState.r8); return &g_registerState.r8; \
      case R9: registerCopy(g_registerState.FROM, g_registerState.r9); return &g_registerState.r9; \
      case R10: registerCopy(g_registerState.FROM, g_registerState.r10); return &g_registerState.r10; \
      case R11: registerCopy(g_registerState.FROM, g_registerState.r11); return &g_registerState.r11; \
      case R12: registerCopy(g_registerState.FROM, g_registerState.r12); return &g_registerState.r12; \
      case R13: registerCopy(g_registerState.FROM, g_registerState.r13); return &g_registerState.r13; \
      case R14: registerCopy(g_registerState.FROM, g_registerState.r14); return &g_registerState.r14; \
      case R15: registerCopy(g_registerState.FROM, g_registerState.r15); return &g_registerState.r15; \
      case RIP: registerCopy(g_registerState.FROM, g_registerState.rip); return &g_registerState.rip; \
      case RFLAGS: registerCopy(g_registerState.FROM, g_registerState.rflags); return &g_registerState.rflags; \
      case XMM0: registerCopy(g_registerState.FROM, g_registerState.xmm0); return &g_registerState.xmm0; \
      case XMM1: registerCopy(g_registerState.FROM, g_registerState.xmm1); return &g_registerState.xmm1; \
      case XMM2: registerCopy(g_registerState.FROM, g_registerState.xmm2); return &g_registerState.xmm2; \
      case XMM3: registerCopy(g_registerState.FROM, g_registerState.xmm3); return &g_registerState.xmm3; \
      default: break; \
    } \
    break;
// clang-format on

// Register holds an integer. It does not hold the value of the register itself. No recursion!
RegisterVal *registerMove(Register &fromRegSlot, Register &intoRegSlot) {
  // printf("Moving Register: %d into Register: %d\n", fromRegSlot, intoRegSlot);
  switch (fromRegSlot) {
    REG_MOVE_CASE(RAX, rax)
    REG_MOVE_CASE(RBX, rbx)
    REG_MOVE_CASE(RCX, rcx)
    REG_MOVE_CASE(RDX, rdx)
    REG_MOVE_CASE(RBP, rbp)
    REG_MOVE_CASE(RSP, rsp)
    REG_MOVE_CASE(RSI, rsi)
    REG_MOVE_CASE(RDI, rdi)
    REG_MOVE_CASE(R8, r8)
    REG_MOVE_CASE(R9, r9)
    REG_MOVE_CASE(R10, r10)
    REG_MOVE_CASE(R11, r11)
    REG_MOVE_CASE(R12, r12)
    REG_MOVE_CASE(R13, r13)
    REG_MOVE_CASE(R14, r14)
    REG_MOVE_CASE(R15, r15)
    REG_MOVE_CASE(RIP, rip)
    REG_MOVE_CASE(RFLAGS, rflags)
    REG_MOVE_CASE(XMM0, xmm0)
    REG_MOVE_CASE(XMM1, xmm1)
    REG_MOVE_CASE(XMM2, xmm2)
    REG_MOVE_CASE(XMM3, xmm3)
  default:
    break;
  }
  return nullptr;
}

// We are really only interested in MOV / MOVABS, and LEA instructions.
void registerProcessInstruction(Instruction &instr) {
  if (instr.type == FUNCTION_START) {
    registerClearState();
    return;
  } else if (instr.type == NO_INSTR) {
    return;
  }

  std::string_view operand1, operand2, operand3;
  instructionReadOperands(instr, operand1, operand2, operand3);

  std::string_view commentSymbol;
  bool hasCommentSymbol = instr.commentSymbolStart && instr.commentSymbolEnd;
  if (hasCommentSymbol) {
    commentSymbol = std::string_view(instr.commentSymbolStart, instr.commentSymbolEnd - instr.commentSymbolStart);
  }

  switch (instr.type) {
  case MOVABS: {
    // movabs $0x116b2c0, %rbx
    // a1 is the value, a2 is the register
    Register a1 = registerGetType(operand2);
    u64 a2 = hexStr2Int64(operand1);
    registerSetVal(a1, a2, hasCommentSymbol, commentSymbol);
    break;
  }
  case MOV: {
    // mov    %rdi,%rax
    // a1 is the source register, a2 is the destination register
    Register a1 = registerGetType(operand1);
    Register a2 = registerGetType(operand2);
    RegisterVal *reg = registerMove(a1, a2);
    if (hasCommentSymbol && reg) {
      StringCopyInto(reg->symbolValue, commentSymbol.data(), commentSymbol.size(), MAX_SYMBOL_SIZE);
    }
    break;
  }
  case LEA: {
    // lea    0x1647ede(%rip),%rsi        # 86d4120 <VanillaStates::Height>
    // a1 is the address, a2 is the register. The address typically is resolved to a symbol by objdump disassembler, so
    // we can use it instead of a relative address.
    Register intoReg = registerGetType(operand2);
    RegisterVal *rv = registerSetVal(intoReg, instr.commentAddr, hasCommentSymbol, commentSymbol);
    break;
  }
  case CALL:
  case OTHER:
    break;
  case FUNCTION_START:
    break;
  default:
    break;
  }
}

void registerDumpCallArgs() {
  auto arg1 = registerGetArgInt(0);
  auto arg2 = registerGetArgInt(1);
  auto arg3 = registerGetArgInt(2);
  auto fArg1 = registerGetArgFloat(0);
  auto fArg2 = registerGetArgFloat(1);
  auto fArg3 = registerGetArgFloat(2);
  // clang-format off
  fprintf(
    stderr,
    "Args: iArg1: %lld (%s), iArg2: %lld (%s), iArg3: %lld (%s) ; fArg1: %f (%s), fArg2: %f (%s), fArg3: %f (%s)\n",
    arg1.value, arg1.symbolValue, 
    arg2.value, arg2.symbolValue, 
    arg3.value, arg3.symbolValue, 
    fArg1.doubleValue(), fArg1.symbolValue,
    fArg2.doubleValue(), fArg2.symbolValue, 
    fArg3.doubleValue(), fArg3.symbolValue
  );
  // clang-format on
}