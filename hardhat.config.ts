import * as dotenv from 'dotenv'

import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import 'hardhat-gas-reporter'
import 'solidity-coverage'
import { HardhatUserConfig, task} from 'hardhat/config'

dotenv.config()

task('deploy', 'Deploys contract by given name')
  .addParam('name', 'Contract name')
  .setAction(async (taskArgs: any, hre: any) => {
    const contractFactory = await hre.ethers.getContractFactory(taskArgs.name)
    const contract = await contractFactory.deploy()
    await contract.deployed()

    console.log(`${taskArgs.name} deployed to: ${contract.address}`)
  })

const config: HardhatUserConfig = {
  solidity: '0.8.4',
  networks: {
    ropsten: {
      url: process.env.ROPSTEN_URL ?? '',
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : []
    },
    rinkeby: {
      url: process.env.RINKEBY_URL ?? '',
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : []
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD'
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
}

export default config
