pragma circom 2.0.6;

include "../../circuits/ownership_verify_ecdsa.circom";

component main {public [pubkeyHash, msghash]} = OwnershipVerifyECDSA(64, 4);
