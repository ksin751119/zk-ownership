import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { Wallet } from 'ethers';
import { buildBabyjub, buildEddsa } from 'circomlibjs';

const PrivateKey = '';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const babyJub = await buildBabyjub();
  const eddsa = await buildEddsa();
  const F = babyJub.F;

  const owner = new Wallet(PrivateKey);
  const eddsaKey = await owner.signMessage('EDDSA Private Key');
  const pubKey = eddsa.prv2pub(eddsaKey);
  const pubkeyX = F.toObject(pubKey[0]);
  const pubkeyY = F.toObject(pubKey[1]);

  const verifier = await deployments.get('EDDSAMIMCVerifier');
  await deploy('ZkOwnershipEDDSAMIMC', {
    from: deployer,
    args: [verifier.address, pubkeyX, pubkeyY],
    log: true,
  });
};

export default func;

func.tags = ['ZkOwnershipEDDSAMIMC'];
func.dependencies = ['EDDSAMIMCVerifier'];
