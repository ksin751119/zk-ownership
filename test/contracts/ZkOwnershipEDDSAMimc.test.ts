import path from 'path';
import { expect } from 'chai';
import { ethers, deployments } from 'hardhat';
import { Wallet, BigNumber } from 'ethers';
import { groth16 } from 'snarkjs';
import { buildBabyjub, buildEddsa, buildMimc7 } from 'circomlibjs';
import { EDDSAMIMCVerifier, ZkOwnershipEDDSAMIMC, ServiceMock } from '../../typechain';
import { bigNumberToBigIntArray, formatProofForVerifierContract, simpleEncode, sendEther } from '../utils/utils';

const buildPath = '../../public';
const circuitName = 'ownership_eddsa_mimc';
const eddsaSignatureMsg = 'EDDSA Private Key';

describe('Ownership eddsa mimc verifier', function () {
  let babyJub: any;
  let mimc7: any;
  let eddsa: any;
  let F: any;
  let owner: Wallet;
  let relayer: Wallet;

  let verifier: EDDSAMIMCVerifier;
  let zkOwnership: ZkOwnershipEDDSAMIMC;
  let service: ServiceMock;

  let circuitWasmPath: string;
  let zkeyPath: string;

  const n = 64;
  const k = 4;

  const setupTest = deployments.createFixture(async ({ deployments, ethers }, options) => {
    await deployments.fixture(''); // ensure you start from a fresh deployments

    babyJub = await buildBabyjub();
    eddsa = await buildEddsa();
    mimc7 = await buildMimc7();
    F = babyJub.F;

    owner = ethers.Wallet.createRandom(); // use it for public key
    [relayer] = await (ethers as any).getSigners();

    // Generate eddsa key
    const eddsaKey = await owner.signMessage(eddsaSignatureMsg);
    const pubKey = eddsa.prv2pub(eddsaKey);
    const pubkeyX = F.toObject(pubKey[0]);
    const pubkeyY = F.toObject(pubKey[1]);

    // Deploy contracts
    verifier = await (await ethers.getContractFactory('EDDSAMIMCVerifier')).deploy();
    await verifier.deployed();
    zkOwnership = await (
      await ethers.getContractFactory('ZkOwnershipEDDSAMIMC')
    ).deploy(verifier.address, pubkeyX, pubkeyY);
    await zkOwnership.deployed();

    // Send ether to zk ownership contract
    await sendEther(relayer, zkOwnership.address, ethers.utils.parseUnits('10', 'ether'));

    service = await (await ethers.getContractFactory('ServiceMock')).deploy(zkOwnership.address);
    await service.deployed();

    circuitWasmPath = path.join(__dirname, buildPath, `${circuitName}.wasm`);
    zkeyPath = path.join(__dirname, buildPath, `${circuitName}.zkey`);
  });

  // `beforeEach` will run before each test, re-deploying the contract every
  // time. It receives a callback, which can be async.
  beforeEach(async function () {
    await setupTest();
  });

  it('normal', async () => {
    // Get proof
    const eddsaKey = await owner.signMessage(eddsaSignatureMsg);
    const nonce = await zkOwnership.nonce();
    const sValue = ethers.BigNumber.from(123);
    const execData = simpleEncode('setValue(uint256)', [sValue]);
    const to = service.address;
    const value = ethers.utils.parseUnits('1', 'ether');
    const msg = ethers.utils.solidityKeccak256(
      ['uint256', 'address', 'bytes', 'uint256'],
      [nonce, to, execData, value]
    );
    const { proof } = await generateProof(msg, eddsaKey);

    // Execute zk-ownership contract
    await zkOwnership.connect(relayer).execWithProof(formatProofForVerifierContract(proof), to, execData, value);
    expect(await service.value()).to.be.eq(sValue);
    expect(await ethers.provider.getBalance(service.address)).to.be.eq(value);
    expect(await zkOwnership.nonce()).to.be.eq(nonce.add(BigNumber.from(1)));
  });

  it('change owner', async () => {
    const other = ethers.Wallet.createRandom(); // use it for public key
    const otherEDDSAKey = await other.signMessage(eddsaSignatureMsg);
    const otherPubKey = eddsa.prv2pub(otherEDDSAKey);
    const otherPubKeyX = F.toObject(otherPubKey[0]);
    const otherPubKeyY = F.toObject(otherPubKey[1]);

    // Get proof
    const eddsaKey = await owner.signMessage(eddsaSignatureMsg);
    const nonce = await zkOwnership.nonce();
    const execData = simpleEncode('setPubkey(uint256,uint256)', [otherPubKeyX, otherPubKeyY]);
    const to = zkOwnership.address;
    const value = ethers.utils.parseUnits('0', 'ether');
    const msg = ethers.utils.solidityKeccak256(
      ['uint256', 'address', 'bytes', 'uint256'],
      [nonce, to, execData, value]
    );
    const { proof } = await generateProof(msg, eddsaKey);

    // Execute zk-ownership contract
    await zkOwnership.connect(relayer).execWithProof(formatProofForVerifierContract(proof), to, execData, value);
    expect(await zkOwnership.pubkeyX()).to.be.eq(otherPubKeyX);
    expect(await zkOwnership.pubkeyY()).to.be.eq(otherPubKeyY);
    expect(await ethers.provider.getBalance(service.address)).to.be.eq(value);
    expect(await zkOwnership.nonce()).to.be.eq(nonce.add(BigNumber.from(1)));
  });

  it('should revert: wrong nonce', async () => {
    // Get proof
    const eddsaKey = await owner.signMessage(eddsaSignatureMsg);
    const nonce = (await zkOwnership.nonce()).add(BigNumber.from(1));
    const sValue = ethers.BigNumber.from(123);
    const execData = simpleEncode('setValue(uint256)', [sValue]);
    const to = service.address;
    const value = ethers.utils.parseUnits('1', 'ether');
    const msg = ethers.utils.solidityKeccak256(
      ['uint256', 'address', 'bytes', 'uint256'],
      [nonce, to, execData, value]
    );
    const { proof } = await generateProof(msg, eddsaKey);

    // Execute zk-ownership contract
    await expect(
      zkOwnership.connect(relayer).execWithProof(formatProofForVerifierContract(proof), to, execData, value)
    ).to.be.revertedWith('Verify proof fail.');
  });

  it('should revert: wrong execData', async () => {
    // Get proof
    const eddsaKey = await owner.signMessage(eddsaSignatureMsg);
    const nonce = await zkOwnership.nonce();
    const sValue = ethers.BigNumber.from(123);
    const execData = simpleEncode('setValue(uint256)', [sValue]);
    const to = service.address;
    const value = ethers.utils.parseUnits('1', 'ether');
    const msg = ethers.utils.solidityKeccak256(
      ['uint256', 'address', 'bytes', 'uint256'],
      [nonce, to, execData, value]
    );
    const { proof } = await generateProof(msg, eddsaKey);

    // Execute zk-ownership contract
    const invalidExecData = simpleEncode('setValue(uint256)', [ethers.BigNumber.from(456)]);
    await expect(
      zkOwnership.connect(relayer).execWithProof(formatProofForVerifierContract(proof), to, invalidExecData, value)
    ).to.be.revertedWith('Verify proof fail.');
  });

  it('should revert: wrong signature', async () => {
    // Get proof
    const other = ethers.Wallet.createRandom();
    const otherEDDSAKey = await other.signMessage(eddsaSignatureMsg);
    const nonce = await zkOwnership.nonce();
    const sValue = ethers.BigNumber.from(123);
    const execData = simpleEncode('setValue(uint256)', [sValue]);
    const to = service.address;
    const value = ethers.utils.parseUnits('1', 'ether');
    const msg = ethers.utils.solidityKeccak256(
      ['uint256', 'address', 'bytes', 'uint256'],
      [nonce, to, execData, value]
    );
    const { proof } = await generateProof(msg, otherEDDSAKey);

    // Execute zk-ownership contract
    await expect(
      zkOwnership.connect(relayer).execWithProof(formatProofForVerifierContract(proof), to, execData, value)
    ).to.be.revertedWith('Verify proof fail.');
  });

  it('should revert: wrong value', async () => {
    // Get proof
    const eddsaKey = await owner.signMessage(eddsaSignatureMsg);
    const nonce = await zkOwnership.nonce();
    const sValue = ethers.BigNumber.from(123);
    const execData = simpleEncode('setValue(uint256)', [sValue]);
    const to = service.address;
    const value = ethers.utils.parseUnits('1', 'ether');
    const msg = ethers.utils.solidityKeccak256(
      ['uint256', 'address', 'bytes', 'uint256'],
      [nonce, to, execData, value]
    );
    const { proof } = await generateProof(msg, eddsaKey);

    // Execute zk-ownership contract
    const invalidValue = value.sub(BigNumber.from('1'));
    await expect(
      zkOwnership.connect(relayer).execWithProof(formatProofForVerifierContract(proof), to, execData, invalidValue)
    ).to.be.revertedWith('Verify proof fail.');
  });

  async function generateProof(msg: any, eddsaKey: any) {
    const pubKey = eddsa.prv2pub(eddsaKey);
    const msgHashArray = bigNumberToBigIntArray(n, k, BigNumber.from(msg));
    const hash = mimc7.multiHash.bind(mimc7)(msgHashArray);
    const sig = eddsa.signMiMC(eddsaKey, hash);

    // Generate proof
    const inputs = {
      pubKeyX: F.toObject(pubKey[0]),
      pubKeyY: F.toObject(pubKey[1]),
      R8x: F.toObject(sig.R8[0]),
      R8y: F.toObject(sig.R8[1]),
      S: sig.S,
      message: msgHashArray,
    };

    return await groth16.fullProve(inputs, circuitWasmPath, zkeyPath);
  }
});
