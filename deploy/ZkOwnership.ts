import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { Wallet, BigNumber } from 'ethers';
import { buildPedersenHash, buildBabyjub } from 'circomlibjs';

const PrivateKey = '';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const owner = new Wallet(PrivateKey);
  const babyJub = await buildBabyjub();
  const pedersen = await buildPedersenHash();
  const F = babyJub.F;
  const pubkey = owner.publicKey.substring(4); // remove 0x4b
  const pubkeyData = Buffer.from(pubkey, 'hex').reverse();
  const h = pedersen.hash(pubkeyData);
  const hP = babyJub.unpackPoint(h);

  const verifier = await deployments.get('Verifier');
  await deploy('ZkOwnership', {
    from: deployer,
    args: [verifier.address, BigNumber.from(F.toObject(hP[0]))],
    log: true,
  });
};

export default func;

func.tags = ['ZkOwnership'];
func.dependencies = ['Verifier'];
