// import { ethers, deployments } from 'hardhat';

const { groth16 } = require('snarkjs');
const { impersonateAndInjectEther } = require('./utils/utils');

// import { Verifier } from '../typechain';

const { Verifier } = require('../typechain');
const secp256k1 = require('@noble/secp256k1');
const path = require('path');
// const ethers = require('ethers');
const ffjavascript = require('ffjavascript');
const { expect } = require('chai');
const { ethers, deployments } = require('hardhat');
// import { ethers, deployments } from 'hardhat';

// const Scalar = require('ffjavascript').Scalar;

const buildPedersenHash = require('circomlibjs').buildPedersenHash;
const buildBabyJub = require('circomlibjs').buildBabyjub;
// const wasmTester = require('circom_tester').wasm;

describe('Verifier', function () {
  let babyJub;
  let pedersen;
  let F;
  let circuit;
  let privKey;

  let owner;
  let relayer;
  let other;

  let verifier;
  let zkOwnership;

  const setupTest = deployments.createFixture(async ({ deployments, ethers }, options) => {
    await deployments.fixture(''); // ensure you start from a fresh deployments

    babyJub = await buildBabyJub();
    F = babyJub.F;
    pedersen = await buildPedersenHash();

    owner = ethers.Wallet.createRandom();
    relayer = ethers.Wallet.createRandom();
    other = ethers.Wallet.createRandom();
    await impersonateAndInjectEther(owner.address);
    await impersonateAndInjectEther(relayer.address);
    await impersonateAndInjectEther(other.address);

    verifier = await (await ethers.getContractFactory('Verifier')).deploy();
    await verifier.deployed();

    const pubkeyData = Buffer.from(owner.publicKey.substring(2), 'hex').reverse();
    const h = pedersen.hash(pubkeyData);
    const hP = babyJub.unpackPoint(h);

    zkOwnership = await (await ethers.getContractFactory('ZkOwnership')).deploy(verifier.address, F.toObject(hP[0]));
    await zkOwnership.deployed();
  });

  // `beforeEach` will run before each test, re-deploying the contract every
  // time. It receives a callback, which can be async.
  beforeEach(async function () {
    // setupTest will use the evm_snapshot to reset environment for speed up testing
    await setupTest();
  });

  it.only('normal send eth to other', async () => {
    const circuitWasmPath = path.join(__dirname, buildPath, `${circuitName}.wasm`);
    const zkeyPath = path.join(__dirname, buildPath, `${circuitName}.zkey`);
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, circuitWasmPath, zkeyPath);

    return { proof, publicSignals };

    const circuitWasmPath = buildPath + `${proofType}.wasm`;
    const zkeyPath = buildPath + `${proofType}.zkey`;
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, circuitWasmPath, zkeyPath);

    // const pubkey = secp256k1.Point.fromPrivateKey(privKey);
    // // Generate pubkey
    // const pubkeyData = Buffer.from(pubkey.toHex().substring(2), 'hex').reverse();
    // const h = pedersen.hash(pubkeyData);
    // const hP = babyJub.unpackPoint(h);
    // const pub0Array = bigintToArray(64, 4, pubkey.x);
    // const pub1Array = bigintToArray(64, 4, pubkey.y);
    // // Get Signature
    // const nonce = 100;
    // const execData = '0x123456';
    // const msgHash = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [nonce, execData]);
    // const sig = await secp256k1.sign(msgHash.substring(2), bigintToUint8Array(privKey), {
    //   canonical: true,
    //   der: false,
    // });
    // // Prepare signal
    // const r = sig.slice(0, 32);
    // const rBigint = uint8ArrayToBigint(r);
    // const s = sig.slice(32, 64);
    // const sBigint = uint8ArrayToBigint(s);
    // const rArray = bigintToArray(64, 4, rBigint);
    // const sArray = bigintToArray(64, 4, sBigint);
    // const msgHashBight = BigInt(msgHash);
    // const msghashArray = bigintToArray(64, 4, msgHashBight);
    // // Generate wintness
    // const witness = await circuit.calculateWitness({
    //   r: rArray,
    //   s: sArray,
    //   msghash: msghashArray,
    //   pubkeyHash: F.toObject(hP[0]),
    //   pubkey: [pub0Array, pub1Array],
    // });
    // await circuit.checkConstraints(witness);
  });

  it('should failed: wrong msgHash', async () => {
    // Generate pubkey
    const pubkey = secp256k1.Point.fromPrivateKey(privKey);
    const pubkeyData = Buffer.from(pubkey.toHex().substring(2), 'hex').reverse();
    const h = pedersen.hash(pubkeyData);
    const hP = babyJub.unpackPoint(h);
    const pub0Array = bigintToArray(64, 4, pubkey.x);
    const pub1Array = bigintToArray(64, 4, pubkey.y);

    // Get Signature
    const nonce = 100;
    const execData = '0x123456';
    const msgHash = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [nonce, execData]);
    const sig = await secp256k1.sign(msgHash.substring(2), bigintToUint8Array(privKey), {
      canonical: true,
      der: false,
    });

    // Prepare signal
    const r = sig.slice(0, 32);
    const rBigint = uint8ArrayToBigint(r);
    const s = sig.slice(32, 64);
    const sBigint = uint8ArrayToBigint(s);
    const rArray = bigintToArray(64, 4, rBigint);
    const sArray = bigintToArray(64, 4, sBigint);
    const fakeMsgHashBight = BigInt('0x1111111111111111111111111111111111111111111111111111111111111111');
    const msghashArray = bigintToArray(64, 4, fakeMsgHashBight);

    // Generate wintness
    await expect(
      circuit.calculateWitness({
        r: rArray,
        s: sArray,
        msghash: msghashArray,
        pubkeyHash: F.toObject(hP[0]),
        pubkey: [pub0Array, pub1Array],
      })
    ).toThrow(new Error('Error: Assert Failed'));

    // expect(await circuit.checkConstraints(witness)).toThrow(new Error('Error: Assert Failed'));
  });
});

// bigendian

function uint8ArrayToBigint(x) {
  let ret = BigInt(0);
  for (let idx = 0; idx < x.length; idx++) {
    ret = ret * BigInt(256);
    ret = ret + BigInt(x[idx]);
  }
  return ret;
}

function bigintToArray(n, k, x) {
  // 把 bigint 切成四等份的 bigint
  let mod = BigInt(1);
  for (let idx = 0; idx < n; idx++) {
    mod = mod * BigInt(2);
  }

  const ret = [];
  let xTemp = x;
  for (let idx = 0; idx < k; idx++) {
    ret.push(xTemp % mod);
    xTemp = xTemp / mod;
  }
  return ret;
}

// bigendian
function bigintToUint8Array(x) {
  const ret = new Uint8Array(32);
  for (let idx = 31; idx >= 0; idx--) {
    ret[idx] = Number(x % 256n);
    x = x / 256n;
  }
  return ret;
}
