pragma circom 2.0.6;

include "./VerifySignature.circom";

component main {public [pubkeyHash, msghash]} = VerifySignature(64, 4);
