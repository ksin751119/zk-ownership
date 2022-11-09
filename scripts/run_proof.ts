import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { groth16 } from 'snarkjs';
import { utils } from 'ffjavascript';
import { bigNumberToBigIntArray, formatProofForVerifierContract, simpleEncode } from '../test/utils/utils';
import { buildPedersenHash, buildBabyjub } from 'circomlibjs';

const PUBKEY =
  '0x040e3a9eb04fba4872c96d150caa7ed60b9926ec80f0ce6a6e7f06b2a47f20a3fffbe0f19d3a7ee0a32e96afbc78fe72b49e628f86bf631779a0dacc66867811c9';
const SIGR = '0x903b76f73c93e71b0f7b44094d900178f3b56aec103994bcfc802b7adac166ff';
const SIGS = '0x7c37a230538ed892fc4ef70f38c7e6c482407f5c03012e983dc2570e0095696c';
const MSG = '0x5fcf91ce5ec46b045a804e6112dc55f86ab2a5a2de5773a636834e00c7472065';
const execData =
  '0xa9059cbb00000000000000000000000069d6226c8ee20b6e08982eb29e145523b25780cb0000000000000000000000000000000000000000000000001bc16d674ec80000';
const to = '0x466595626333c55fa7d7Ad6265D46bA5fDbBDd99';
const n = 64;
const k = 4;
const circuitWasmPath = './build/ownership_verify_js/ownership_verify.wasm';
const zkeyPath = './build/ownership_verify.zkey';

async function main() {
  console.log('start to generate proof...');
  const { proof } = await generateProof(MSG, SIGR, SIGS, PUBKEY);
  // console.log('proof', proof);

  const txdata = simpleEncode('execWithProof(uint256[8],address,bytes)', [
    formatProofForVerifierContract(proof),
    to,
    execData,
  ]);

  console.log(txdata.toString());
  console.log('generate proof finish.');
}

async function generateProof(msg: string, sigR: string, sigS: string, pubkey: string) {
  const babyJub = await buildBabyjub();
  const pedersen = await buildPedersenHash();
  const F = babyJub.F;
  // Prepare signal
  const msgHash = ethers.utils.hashMessage(ethers.utils.arrayify(msg));
  const pubkeyData = Buffer.from(pubkey.substring(4), 'hex').reverse(); // Remove "0x4b" at the begin of pubkey
  const h = pedersen.hash(pubkeyData);
  const hP = babyJub.unpackPoint(h);
  const rArray = bigNumberToBigIntArray(n, k, BigNumber.from(sigR));
  const sArray = bigNumberToBigIntArray(n, k, BigNumber.from(sigS));
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

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
