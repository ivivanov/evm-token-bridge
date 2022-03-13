import { ethers } from 'hardhat'

async function deployer (contractName: string) {
  const contractFactory = await ethers.getContractFactory(contractName)
  const contract = await contractFactory.deploy()
  console.log(`${contractName} deployed to: ${contract.address}`)

  return await contract.deployed()
}

async function main () {
  await deployer('AcmeToken')
  await deployer('Escrow')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
