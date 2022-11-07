// import { expect, assert } from 'chai';
// import { BigNumber, Signer, constants } from 'ethers';
// import { BigNumber as BigNumberJs } from 'bignumber.js';
const { ethers } = require('hardhat');
// import {
//   RecordActionResultSig,
//   DeltaGasSig,
//   USDC_TOKEN,
//   WETH_TOKEN,
//   WMATIC_TOKEN,
//   QUICKSWAP_FACTORY,
//   SUSHISWAP_FACTORY,
//   RecordHandlerResultSig,
//   CURVE_ADDRESS_PROVIDER,
//   ONE_YEAR,
// } from './constants';
const hre = require('hardhat');

async function impersonateAndInjectEther(address) {
  _impersonateAndInjectEther(address);
  return await ethers.getSigner(address);
}

async function _impersonateAndInjectEther(address) {
  // Impersonate pair
  await hre.network.provider.send('hardhat_impersonateAccount', [address]);

  // Inject 1 ether
  await hre.network.provider.send('hardhat_setBalance', [address, '0xde0b6b3a7640000']);
}

function formatProofForVerifierContract(_proof) {
  return [
    _proof.pi_a[0],
    _proof.pi_a[1],
    _proof.pi_b[0][1],
    _proof.pi_b[0][0],
    _proof.pi_b[1][1],
    _proof.pi_b[1][0],
    _proof.pi_c[0],
    _proof.pi_c[1],
  ].map((x) => x.toString());
}

function simpleEncode(_func, params) {
  const func = 'function ' + _func;
  const abi = [func];
  const iface = new ethers.utils.Interface(abi);
  const data = iface.encodeFunctionData(_func, params);

  return data;
}

// async function genProofAndPublicSignals(circuitName, inputs) {
//   const circuitWasmPath = path.join(__dirname, buildPath, `${circuitName}.wasm`);
//   const zkeyPath = path.join(__dirname, buildPath, `${circuitName}.zkey`);
//   const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, circuitWasmPath, zkeyPath);

//   return { proof, publicSignals };
// }

module.exports = {
  impersonateAndInjectEther,
  formatProofForVerifierContract,
  simpleEncode,
};
