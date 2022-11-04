import * as dotenv from 'dotenv';

import { HardhatUserConfig, task } from 'hardhat/config';
import '@nomiclabs/hardhat-etherscan';
import '@nomicfoundation/hardhat-chai-matchers';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import 'hardhat-deploy';
import '@nomiclabs/hardhat-ethers';
import '@xplorfin/hardhat-solc-excludes';

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.10',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
    excludes: {
      directories: ['test/foundry'],
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
  networks: {
    hardhat: {
      forking: {
        enabled: process.env.RPC_NODE !== undefined,
        url: process.env.RPC_NODE || '',
      },
      chainId: Number(process.env.CHAIN_ID) || 1,
      gasPrice: 0,
      gas: 30000000,
      initialBaseFeePerGas: 0,
      allowUnlimitedContractSize: true,
      accounts: {
        mnemonic: 'dice shove sheriff police boss indoor hospital vivid tenant method game matter',
        path: "m/44'/60'/0'/0",
        initialIndex: 0,
      },
    },
    prod: {
      url: process.env.PROD_URL || '',
      accounts: process.env.PROD_SECRET !== undefined ? [process.env.PROD_SECRET] : [],
      gas: 6000000,
    },
    beta: {
      url: process.env.BETA_URL || '',
      accounts: process.env.BETA_SECRET !== undefined ? [process.env.BETA_SECRET] : [],
      gas: 6000000,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  mocha: {
    timeout: 900000,
  },
};

export default config;
