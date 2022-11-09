import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
const hre = require('hardhat');

export function bigNumberToBigIntArray(n: number, k: number, x: BigNumber) {
  // bigendian
  let mod = BigNumber.from(1);
  const two = BigNumber.from(2);

  for (let idx = 0; idx < n; idx++) {
    mod = mod.mul(two);
  }

  const ret: BigInt[] = [];
  let xTemp: BigNumber = x;
  for (let idx = 0; idx < k; idx++) {
    ret.push(xTemp.mod(mod).toBigInt());
    xTemp = xTemp.div(mod);
  }
  return ret;
}

export async function impersonateAndInjectEther(address: string) {
  _impersonateAndInjectEther(address);
  return await (ethers as any).getSigner(address);
}

export async function _impersonateAndInjectEther(address: string) {
  // Impersonate pair
  await hre.network.provider.send('hardhat_impersonateAccount', [address]);

  // Inject 1 ether
  await hre.network.provider.send('hardhat_setBalance', [address, '0xde0b6b3a7640000']);
}

export function simpleEncode(_func: string, params: any) {
  const func = 'function ' + _func;
  const abi = [func];
  const iface = new ethers.utils.Interface(abi);
  const data = iface.encodeFunctionData(_func, params);

  return data;
}

export function formatProofForVerifierContract(
  _proof: any
): [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber, BigNumber] {
  return [
    _proof.pi_a[0],
    _proof.pi_a[1],
    _proof.pi_b[0][1],
    _proof.pi_b[0][0],
    _proof.pi_b[1][1],
    _proof.pi_b[1][0],
    _proof.pi_c[0],
    _proof.pi_c[1],
  ];
}
