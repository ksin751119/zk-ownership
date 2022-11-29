

pragma circom 2.0.0;

include "../../circuits/ownership_verify_eddsa_mimc.circom";

component main {public [pubKeyX, pubKeyY, message]} = OwnershipVerifyEddsaMIMC(4);
