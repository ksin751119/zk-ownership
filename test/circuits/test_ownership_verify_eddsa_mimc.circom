

pragma circom 2.0.6;

include "../../circuits/ownership_verify_eddsa_mimc.circom";

component main {public [pubKeyX, pubKeyY, message]} = OwnershipVerifyEDDSAMIMC(4);
