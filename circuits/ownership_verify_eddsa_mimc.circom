pragma circom 2.0.4;

include "../node_modules/circomlib/circuits/eddsamimc.circom";
include "../node_modules/circomlib/circuits/mimc.circom";


template OwnershipVerifyEddsaMIMC(messageLength) {

  // Public signal
  signal input pubKeyX;
  signal input pubKeyY;
  signal input message[messageLength];

  // Private signal
  signal input R8x;
  signal input R8y;
  signal input S;


  // Hash message
  component mimc7 = MultiMiMC7(messageLength, 91);
  mimc7.k <== 0;
  for (var i = 0; i < messageLength; i++) {
    mimc7.in[i] <== message[i];
  }

  // Verify the signature
  component verifier = EdDSAMiMCVerifier();
  verifier.enabled <== 1;
  verifier.Ax <== pubKeyX;
  verifier.Ay <== pubKeyY;
  verifier.R8x <== R8x;
  verifier.R8y <== R8y;
  verifier.S <== S;
  verifier.M <== mimc7.out;
}
