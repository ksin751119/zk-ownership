pragma circom 2.0.6;

include "./ownership_verify.circom";

component main {public [pubkeyHash, msghash]} = OwnershipVerify(64, 4);
