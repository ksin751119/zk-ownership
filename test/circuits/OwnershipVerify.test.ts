import path from 'path';
import { buildPedersenHash, buildBabyjub } from 'circomlibjs';
import { wasm as wasmTester } from 'circom_tester';
import { Wallet, BigNumber } from 'ethers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { bigNumberToBigIntArray } from '../utils/utils';

describe('ownership verify', function () {
  let babyJub: any;
  let pedersen: any;
  let F: any;
  let circuit: any;
  let owner: Wallet;

  const n = 64;
  const k = 4;

  before(async () => {
    owner = ethers.Wallet.createRandom();
    babyJub = await buildBabyjub();
    pedersen = await buildPedersenHash();
    F = babyJub.F;

    circuit = await wasmTester(path.join(__dirname, '../../circuits', 'ownership_verify.circom'), {
      output: './build',
    });
  });

  it('normal', async () => {
    // Get pedersen hash of pubkey
    const pubkey = owner.publicKey;
    const pubkeyData = Buffer.from(pubkey.substring(4), 'hex').reverse(); // Remove "0x4b" at the begin of pubkey
    const h = pedersen.hash(pubkeyData);
    const hP = babyJub.unpackPoint(h);

    // Get hash data for signature
    const nonce = 100;
    const execData = '0x123456';
    const msg = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [nonce, execData]);
    const msgHash = ethers.utils.hashMessage(msg);
    const flatSig = await owner.signMessage(msg);

    // Prepare signal
    const sig = ethers.utils.splitSignature(flatSig);
    const rArray = bigNumberToBigIntArray(n, k, BigNumber.from(sig.r));
    const sArray = bigNumberToBigIntArray(n, k, BigNumber.from(sig.s));
    const msgHashArray = bigNumberToBigIntArray(n, k, BigNumber.from(msgHash));
    const pub0Array = bigNumberToBigIntArray(n, k, BigNumber.from('0x' + pubkey.substring(4, 68)));
    const pub1Array = bigNumberToBigIntArray(n, k, BigNumber.from('0x' + pubkey.substring(68)));

    // Calculate witness
    const witness = await circuit.calculateWitness({
      r: rArray,
      s: sArray,
      msghash: msgHashArray,
      pubkeyHash: F.toObject(hP[0]),
      pubkey: [pub0Array, pub1Array],
    });
    await circuit.checkConstraints(witness);
  });

  it.only('should fail: wrong msgHash', async () => {
    // Get pedersen hash of pubkey
    const pubkey = owner.publicKey;
    const pubkeyData = Buffer.from(pubkey.substring(4), 'hex').reverse(); // Remove "0x4b" at the begin of pubkey
    const h = pedersen.hash(pubkeyData);
    const hP = babyJub.unpackPoint(h);

    // Get hash data for signature
    const nonce = 100;
    const execData = '0x123456';
    const msg = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [nonce, execData]);
    const flatSig = await owner.signMessage(msg);

    // Prepare signal
    const wrongMsg = ethers.utils.solidityKeccak256(['string'], ['wrongMsg']);
    const sig = ethers.utils.splitSignature(flatSig);
    const rArray = bigNumberToBigIntArray(n, k, BigNumber.from(sig.r));
    const sArray = bigNumberToBigIntArray(n, k, BigNumber.from(sig.s));
    const msgHashArray = bigNumberToBigIntArray(n, k, BigNumber.from(wrongMsg));
    const pub0Array = bigNumberToBigIntArray(n, k, BigNumber.from('0x' + pubkey.substring(4, 68)));
    const pub1Array = bigNumberToBigIntArray(n, k, BigNumber.from('0x' + pubkey.substring(68)));

    // Generate witness

    let err;
    try {
      await circuit.calculateWitness({
        r: rArray,
        s: sArray,
        msghash: msgHashArray,
        pubkeyHash: F.toObject(hP[0]),
        pubkey: [pub0Array, pub1Array],
      });
    } catch (error: any) {
      err = error;
    }
    expect(err.message).to.include('Error: Assert Failed');
  });
});
