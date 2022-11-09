import path from 'path';
import { expect } from 'chai';
import { ethers, deployments } from 'hardhat';
import { Wallet, BigNumber, Signature } from 'ethers';
import { groth16 } from 'snarkjs';
import { buildPedersenHash, buildBabyjub } from 'circomlibjs';
import { utils } from 'ffjavascript';
import { Verifier, ZkOwnership, ServiceMock } from '../../typechain';
import { bigNumberToBigIntArray, formatProofForVerifierContract, simpleEncode } from '../utils/utils';

const buildPath = '../../build';
const circuitName = 'ownership_verify';

describe('Verifier', function () {
  let babyJub: any;
  let pedersen: any;
  let F: any;
  let owner: Wallet;
  let relayer: Wallet;

  let verifier: Verifier;
  let zkOwnership: ZkOwnership;
  let service: ServiceMock;

  let circuitWasmPath: string;
  let zkeyPath: string;

  const n = 64;
  const k = 4;

  const setupTest = deployments.createFixture(async ({ deployments, ethers }, options) => {
    await deployments.fixture(''); // ensure you start from a fresh deployments

    babyJub = await buildBabyjub();
    pedersen = await buildPedersenHash();
    F = babyJub.F;

    owner = ethers.Wallet.createRandom(); // use it for public key
    [relayer] = await (ethers as any).getSigners();

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

    circuitWasmPath = path.join(__dirname, buildPath, `${circuitName}_js`, `${circuitName}.wasm`);
    zkeyPath = path.join(__dirname, buildPath, `${circuitName}.zkey`);

    console.log('service', service.address);
    console.log('verifier', verifier.address);
    console.log('zkOwnership', zkOwnership.address);
  });

  // `beforeEach` will run before each test, re-deploying the contract every
  // time. It receives a callback, which can be async.
  beforeEach(async function () {
    await setupTest();
  });

  it('normal', async () => {
    // Get proof
    const nonce = await zkOwnership.nonce();
    const sValue = ethers.BigNumber.from(123);
    const execData = simpleEncode('setValue(uint256)', [sValue]);
    const to = service.address;
    const msg = ethers.utils.solidityKeccak256(['uint256', 'address', 'bytes'], [nonce, to, execData]);
    const sig = ethers.utils.splitSignature(await owner.signMessage(ethers.utils.arrayify(msg)));

    const { proof } = await generateProof(msg, sig, owner.publicKey);

    // Execute zk-ownership contract
    await zkOwnership.connect(relayer).execWithProof(formatProofForVerifierContract(proof), to, execData);
    expect(await service.value()).to.be.eq(sValue);
    expect(await zkOwnership.nonce()).to.be.eq(nonce.add(BigNumber.from(1)));
  });

  it('change owner', async () => {
    const other = ethers.Wallet.createRandom(); // use it for public key
    const pubkey = other.publicKey.substring(4); // remove 0x4b
    const pubkeyData = Buffer.from(pubkey, 'hex').reverse();
    const h = pedersen.hash(pubkeyData);
    const hP = babyJub.unpackPoint(h);
    const newPubkeyHash = F.toObject(hP[0]);

    // Get proof
    const nonce = await zkOwnership.nonce();
    const execData = simpleEncode('setPubkeyHash(uint256)', [newPubkeyHash]);
    const to = zkOwnership.address;
    const msg = ethers.utils.solidityKeccak256(['uint256', 'address', 'bytes'], [nonce, to, execData]);
    const sig = ethers.utils.splitSignature(await owner.signMessage(ethers.utils.arrayify(msg)));
    const { proof } = await generateProof(msg, sig, owner.publicKey);

    // Execute zk-ownership contract
    await zkOwnership.connect(relayer).execWithProof(formatProofForVerifierContract(proof), to, execData);
    expect(await zkOwnership.pubkeyHash()).to.be.eq(newPubkeyHash);
    expect(await zkOwnership.nonce()).to.be.eq(nonce.add(BigNumber.from(1)));
  });

  it('should revert: wrong nonce', async () => {
    // Get proof
    const nonce = (await zkOwnership.nonce()).add(BigNumber.from(1));
    const sValue = ethers.BigNumber.from(123);
    const execData = simpleEncode('setValue(uint256)', [sValue]);
    const to = service.address;
    const msg = ethers.utils.solidityKeccak256(['uint256', 'address', 'bytes'], [nonce, to, execData]);
    const sig = ethers.utils.splitSignature(await owner.signMessage(ethers.utils.arrayify(msg)));
    const { proof } = await generateProof(msg, sig, owner.publicKey);

    // Execute zk-ownership contract
    await expect(
      zkOwnership.connect(relayer).execWithProof(formatProofForVerifierContract(proof), to, execData)
    ).to.be.revertedWith('Verify proof fail.');
  });

  it('should revert: wrong execData', async () => {
    // Get proof
    const nonce = (await zkOwnership.nonce()).add(BigNumber.from(1));
    const sValue = ethers.BigNumber.from(123);
    const execData = simpleEncode('setValue(uint256)', [sValue]);
    const to = service.address;
    const msg = ethers.utils.solidityKeccak256(['uint256', 'address', 'bytes'], [nonce, to, execData]);
    const sig = ethers.utils.splitSignature(await owner.signMessage(ethers.utils.arrayify(msg)));
    const { proof } = await generateProof(msg, sig, owner.publicKey);

    // Execute zk-ownership contract
    const newExecData = simpleEncode('setValue(uint256)', [ethers.BigNumber.from(456)]);
    await expect(
      zkOwnership.connect(relayer).execWithProof(formatProofForVerifierContract(proof), to, newExecData)
    ).to.be.revertedWith('Verify proof fail.');
  });

  it('should revert: wrong signature', async () => {
    // Get proof
    const other = ethers.Wallet.createRandom(); // use it for public key
    const nonce = (await zkOwnership.nonce()).add(BigNumber.from(1));
    const sValue = ethers.BigNumber.from(123);
    const execData = simpleEncode('setValue(uint256)', [sValue]);
    const to = service.address;
    const msg = ethers.utils.solidityKeccak256(['uint256', 'address', 'bytes'], [nonce, to, execData]);
    const sig = ethers.utils.splitSignature(await other.signMessage(ethers.utils.arrayify(msg)));
    const { proof } = await generateProof(msg, sig, other.publicKey);

    // Execute zk-ownership contract
    const newExecData = simpleEncode('setValue(uint256)', [ethers.BigNumber.from(456)]);
    await expect(
      zkOwnership.connect(relayer).execWithProof(formatProofForVerifierContract(proof), to, newExecData)
    ).to.be.revertedWith('Verify proof fail.');
  });

  async function generateProof(msg: string, sig: Signature, pubkey: string) {
    // Prepare signal
    const msgHash = ethers.utils.hashMessage(ethers.utils.arrayify(msg));
    const pubkeyData = Buffer.from(pubkey.substring(4), 'hex').reverse(); // Remove "0x4b" at the begin of pubkey
    const h = pedersen.hash(pubkeyData);
    const hP = babyJub.unpackPoint(h);
    const rArray = bigNumberToBigIntArray(n, k, BigNumber.from(sig.r));
    const sArray = bigNumberToBigIntArray(n, k, BigNumber.from(sig.s));
    const msgHashArray = bigNumberToBigIntArray(n, k, BigNumber.from(msgHash));
    const pub0Array = bigNumberToBigIntArray(n, k, BigNumber.from('0x' + pubkey.substring(4, 68)));
    const pub1Array = bigNumberToBigIntArray(n, k, BigNumber.from('0x' + pubkey.substring(68)));

    // Generate proof
    const inputs = utils.stringifyBigInts({
      r: rArray,
      s: sArray,
      msghash: msgHashArray,
      pubkeyHash: F.toObject(hP[0]),
      pubkey: [pub0Array, pub1Array],
    });

    return await groth16.fullProve(inputs, circuitWasmPath, zkeyPath);
  }
});
