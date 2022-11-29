import path from 'path';
import { buildBabyjub, buildEddsa, buildMimc7 } from 'circomlibjs';
import { wasm as wasmTester } from 'circom_tester';
import { Wallet, BigNumber } from 'ethers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { bigNumberToBigIntArray } from '../utils/utils';

describe('eddsa mimc', function () {
  let babyJub: any;
  let mimc7: any;
  let eddsa: any;

  let F: any;
  let circuit: any;
  let owner: Wallet;

  const n = 64;
  const k = 4;

  before(async () => {
    owner = ethers.Wallet.createRandom();
    eddsa = await buildEddsa();
    babyJub = await buildBabyjub();
    mimc7 = await buildMimc7();
    F = babyJub.F;

    circuit = await wasmTester(path.join(__dirname, 'test_ownership_verify_eddsa_mimc.circom'), {
      output: './build',
    });
  });

  it('normal', async () => {
    // Generate eddsa key
    const eddsaKey = await owner.signMessage('EDDSA Private Key');
    const pubKey = eddsa.prv2pub(eddsaKey);

    // Generate eddsa signature
    const nonce = 100;
    const execData = '0x123456';
    const msg = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [nonce, execData]);
    const msgHashArray = bigNumberToBigIntArray(n, k, BigNumber.from(msg));
    const hash = mimc7.multiHash.bind(mimc7)(msgHashArray);
    const signature = eddsa.signMiMC(eddsaKey, hash);

    // Generate proof
    const input = {
      pubKeyX: F.toObject(pubKey[0]),
      pubKeyY: F.toObject(pubKey[1]),
      R8x: F.toObject(signature.R8[0]),
      R8y: F.toObject(signature.R8[1]),
      S: signature.S,
      message: msgHashArray,
    };

    const w = await circuit.calculateWitness(input, true);
    await circuit.checkConstraints(w);
  });

  it('should fail: wrong msgHash', async () => {
    // Generate eddsa key
    const eddsaKey = await owner.signMessage('EDDSA Private Key');
    const pubKey = eddsa.prv2pub(eddsaKey);

    // Generate eddsa signature
    const nonce = 100;
    const execData = '0x123456';
    const msg = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [nonce, execData]);
    const msgHashArray = bigNumberToBigIntArray(n, k, BigNumber.from(msg));
    const hash = mimc7.multiHash.bind(mimc7)(msgHashArray);
    const signature = eddsa.signMiMC(eddsaKey, hash);

    // Generate proof
    const msg2 = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [nonce + 1, execData]);
    const msgHashArray2 = bigNumberToBigIntArray(n, k, BigNumber.from(msg2));
    const input = {
      pubKeyX: F.toObject(pubKey[0]),
      pubKeyY: F.toObject(pubKey[1]),
      R8x: F.toObject(signature.R8[0]),
      R8y: F.toObject(signature.R8[1]),
      S: signature.S,
      message: msgHashArray2,
    };

    let err;
    try {
      await circuit.calculateWitness(input, true);
    } catch (error: any) {
      err = error;
    }
    expect(err.message).to.include('Error: Assert Failed');
  });
});
