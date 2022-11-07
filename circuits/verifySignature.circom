pragma circom 2.0.2;
include "../node_modules/circomlib/circuits/pedersen.circom";
include "../node_modules/circomlib/circuits/bitify.circom";
include "./circom-ecdsa-circuits/ecdsa.circom";


// computes Pedersen(pubkey[0], pubkey[1])
template PubkeyHasher(k) {
    signal input pubkey[2][k];
    signal input pubkeyHash;
    component pubkeyHasher = Pedersen(512);
    component pubkeyBits[2][k];

    for (var i = 0; i < k; i++) {
        pubkeyBits[0][i] = Num2Bits(64);
        pubkeyBits[1][i] = Num2Bits(64);
        pubkeyBits[0][i].in <== pubkey[0][i];
        pubkeyBits[1][i].in <== pubkey[1][i];
    }

    component pubkeyNum = Bits2Num(512);
    for (var i = 0; i < 64; i++) {
         for (var j = 0; j < k; j++) {
            pubkeyHasher.in[i+(j*64)] <== pubkeyBits[1][j].out[i];
            pubkeyHasher.in[256+i+(j*64)] <== pubkeyBits[0][j].out[i];
         }
    }
    pubkeyHash === pubkeyHasher.out[0];
}


template VerifySignature(n, k) {
    // Public signal
    signal input pubkeyHash;
    signal input msghash[k];

    // Private signal
    signal input r[k];
    signal input s[k];
    signal input pubkey[2][k];

    // Compare pubkey hash
    component hasher = PubkeyHasher(k);
    hasher.pubkeyHash <== pubkeyHash;
    for (var i = 0; i < k; i++) {
        hasher.pubkey[0][i] <== pubkey[0][i];
        hasher.pubkey[1][i] <== pubkey[1][i];
    }

    // Verify signature
    component ecdsaVerifier = ECDSAVerifyNoPubkeyCheck(n,k);
    for (var i = 0; i < k; i++) {
        ecdsaVerifier.pubkey[0][i] <== pubkey[0][i];
        ecdsaVerifier.pubkey[1][i] <== pubkey[1][i];
        ecdsaVerifier.r[i] <== r[i];
        ecdsaVerifier.s[i] <== s[i];
        ecdsaVerifier.msghash[i] <== msghash[i];
    }

    // Should be 1 if signature is correct
    ecdsaVerifier.result === 1;
}
