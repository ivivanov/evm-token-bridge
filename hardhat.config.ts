import * as dotenv from 'dotenv'

import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-waffle'
import '@typechain/hardhat'
import 'hardhat-gas-reporter'
import 'solidity-coverage'
import 'hardhat-contract-sizer'
import { HardhatUserConfig, task } from 'hardhat/config'

dotenv.config()

async function deploy (contractFactory: any, ctorParams: any[], hre: any): Promise<string> {
  const contract = await contractFactory.deploy(...ctorParams)
  const minTxConfirmations = hre.network.name === 'localhost' ? 1 : 5

  console.log(`\nWaiting for ${minTxConfirmations} confirmations...`)
  const receipt = await contract.deployTransaction.wait(minTxConfirmations)
  console.log(`\n${contract.address} deployed, confirmations: ${receipt.confirmations}`)

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

  return contract.address
}

task('deploy', 'Deploys Utils contract')
  .setAction(async (taskArgs: any, hre: any) => {
    // Deploy Utils
    const Utils = await hre.ethers.getContractFactory('Utils')
    const utils = await deploy(Utils, [], hre)

    // Deploy Bridge with linked Utils
    const Bridge = await hre.ethers.getContractFactory('Bridge', {
      libraries: {
        Utils: utils
      }
    })
    await deploy(Bridge, [process.env.TRUSTED_SIGNER], hre)
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
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: false,
    strict: true
  }
}

export default config
