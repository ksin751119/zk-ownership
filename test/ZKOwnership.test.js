const { impersonateAndInjectEther, formatProofForVerifierContract, simpleEncode } = require('./utils/utils');
const secp256k1 = require('@noble/secp256k1');
const path = require('path');
const snarkjs = require('snarkjs');
const { expect } = require('chai');
const { ethers, deployments } = require('hardhat');
const buildPedersenHash = require('circomlibjs').buildPedersenHash;
const buildBabyJub = require('circomlibjs').buildBabyjub;

const buildPath = '../build';
const circuitName = 'ownership';
describe('Verifier', function () {
  let babyJub;
  let pedersen;
  let F;

  let owner;
  let relayer;
  let other;

  let verifier;
  let zkOwnership;
  let service;

  const setupTest = deployments.createFixture(async ({ deployments, ethers }, options) => {
    await deployments.fixture(''); // ensure you start from a fresh deployments

    babyJub = await buildBabyJub();
    F = babyJub.F;
    pedersen = await buildPedersenHash();

    owner = new ethers.Wallet('0xf5b552f608f5b552f608f5b552f6082ff5b552f608f5b552f608f5b552f6082f');
    // owner = ethers.Wallet.createRandom();
    // relayer = ethers.Wallet.createRandom();
    relayer = new ethers.Wallet('0xf5b552f608f5b552f608f5b552f6082ff5b552f608f5b552f608f5b552f608f1');
    other = new ethers.Wallet('0xf5b552f608f5b552f608f5b552f6082ff5b552f608f5b552f608f5b552f608f2');
    await impersonateAndInjectEther(owner.address);
    await impersonateAndInjectEther(relayer.address);
    await impersonateAndInjectEther(other.address);

    console.log('owner:', owner.address);
    console.log('relayer:', relayer.address);
    console.log('other:', other.address);

    verifier = await (await ethers.getContractFactory('Verifier')).deploy();
    await verifier.deployed();

    const pubkey = owner.publicKey.substring(4); // remove 0x4b
    const pubkeyData = Buffer.from(pubkey, 'hex').reverse();
    const h = pedersen.hash(pubkeyData);
    const hP = babyJub.unpackPoint(h);
    zkOwnership = await (await ethers.getContractFactory('ZkOwnership')).deploy(verifier.address, F.toObject(hP[0]));
    await zkOwnership.deployed();

    service = await (await ethers.getContractFactory('ServiceMock')).deploy(zkOwnership.address);
    await service.deployed();
  });

  // `beforeEach` will run before each test, re-deploying the contract every
  // time. It receives a callback, which can be async.
  beforeEach(async function () {
    await setupTest();
  });

  it('tool', async () => {
    const nonce = 0;
    const to = '0x07b05D3A1ed958944033060d058b8F0771ad1A6e';
    const execData = '0x';

    const msgHash = ethers.utils.solidityKeccak256(['uint256', 'address', 'bytes'], [nonce, to, execData]);
    console.log('msgHash', msgHash);
  });

  it.only('normal send eth to other', async () => {
    console.log('owner', owner.privateKey);
    const privKey = BigInt(owner.privateKey);
    const pubkey = secp256k1.Point.fromPrivateKey(privKey);
    console.log('privKey', privKey);
    console.log('pubkey.toHex()', pubkey.toHex());
    const pubkeyData = Buffer.from(owner.publicKey.substring(4), 'hex').reverse();
    console.log('pubkeyData1', pubkeyData);
    const h = pedersen.hash(pubkeyData);
    const hP = babyJub.unpackPoint(h);
    console.log('pubkey.x', pubkey.x);
    console.log('pubkey.y', pubkey.y);
    console.log('F.toObject(hP[0])2', F.toObject(hP[0]));

    const pub0Array = bigintToArray(64, 4, pubkey.x);
    const pub1Array = bigintToArray(64, 4, pubkey.y);
    // Get Signature
    const nonce = await zkOwnership.nonce();
    const sValue = ethers.BigNumber.from(123);
    const execData = simpleEncode('setValue(uint256)', [sValue]);

    // const data = simpleEncode('swapTokensForExactTokens(uint256,uint256,address[])', [buyAmt, value, path]);
    const to = service.address;
    const msgHash = ethers.utils.solidityKeccak256(['uint256', 'address', 'bytes'], [nonce, to, execData]);
    const sig = await secp256k1.sign(msgHash.substring(2), bigintToUint8Array(privKey), {
      canonical: true,
      der: false,
    });

    console.log('msgHash', msgHash);
    // Prepare signal
    const r = sig.slice(0, 32);
    const rBigint = uint8ArrayToBigint(r);
    const s = sig.slice(32, 64);
    const sBigint = uint8ArrayToBigint(s);
    const rArray = bigintToArray(64, 4, rBigint);
    const sArray = bigintToArray(64, 4, sBigint);
    const msgHashBight = BigInt(msgHash);
    console.log('msgHashBight', msgHashBight);
    const msghashArray = bigintToArray(64, 4, msgHashBight);
    const inputs = {
      r: rArray,
      s: sArray,
      msghash: msghashArray,
      pubkeyHash: F.toObject(hP[0]),
      pubkey: [pub0Array, pub1Array],
    };

    console.log('inputs', inputs);
    const circuitWasmPath = path.join(__dirname, buildPath, `${circuitName}_js`, `${circuitName}.wasm`);
    const zkeyPath = path.join(__dirname, buildPath, `${circuitName}.zkey`);

    console.log('circuitWasmPath', circuitWasmPath);
    console.log('zkeyPath', zkeyPath);

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, circuitWasmPath, zkeyPath);
    console.log('proof', proof);
    console.log('publicSignals', publicSignals);
    await zkOwnership.execWithProof(formatProofForVerifierContract(proof), to, execData);

    expect(await service.value()).to.be.eq(sValue);
  });

  it('proof', async () => {
    const privKey = BigInt(owner.privateKey);
    const nonce = await zkOwnership.nonce();
    const execData = '0x';
    const to = other.address;
    const msgHash = ethers.utils.solidityKeccak256(['uint256', 'bytes'], [nonce, execData]);
    console.log('msgHash', msgHash);
    // const execData = '0x';
    // const to = other.address;
    const proof = {
      pi_a: [
        '21535039539074290427913885725296620248770150731195964608677235189832256288302',
        '4942121980275362709248988718935214982473545930673167375939983227678672454886',
        '1',
      ],
      pi_b: [
        [
          '4062368694262257334915057758914148933931296965917458946446453505357238457616',
          '21615593841211591633395520976286730247363011347959117419726913879001648976789',
        ],
        [
          '9769411744633612213670306635199285131245424626707809100424205606914253871863',
          '13620872983111663209557497835821532540808411354793493599134273356887540552507',
        ],
        ['1', '0'],
      ],
      pi_c: [
        '4954710851996680123367749565142438969091402072135134548782843524950485536145',
        '17009514794444583598073525596222357478505774078996447728399628771283907168422',
        '1',
      ],
      protocol: 'groth16',
      curve: 'bn128',
    };

    await zkOwnership.execWithProof(formatProofForVerifierContract(proof), to, execData);
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
