import * as dotenv from 'dotenv'

import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import 'hardhat-gas-reporter'
import 'solidity-coverage'
import { HardhatUserConfig, task } from 'hardhat/config'

dotenv.config()

task('deploy', 'Deploys contract by given name')
  .addParam('name', 'Contract name')
  .setAction(async (taskArgs: any, hre: any) => {
    const contractFactory = await hre.ethers.getContractFactory(taskArgs.name)
    const contract = await contractFactory.deploy()
    const minTxConfirmations = hre.network.name === 'localhost' ? 1 : 5
    console.log(`\nWaiting for ${minTxConfirmations} confirmations...`)
    const receipt = await contract.deployTransaction.wait(minTxConfirmations)
    console.log(`\n${taskArgs.name} deployed to: ${contract.address} confirmations: ${receipt.confirmations}`)

    if (hre.network.name !== 'localhost') {
      try {
        console.log('\nVerifying contract...')
        await hre.run('verify:verify', { address: contract.address })
      } catch (err: any) {
        if (err.message.includes('Reason: Already Verified')) {
          console.log('\nContract is already verified!')
        }
      }
    }
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
