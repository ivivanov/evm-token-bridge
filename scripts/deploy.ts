import { ethers } from 'hardhat'
import { Contract } from 'ethers'

async function deployer (contractName: string, ...args: any[]): Promise<Contract> {
  const contractFactory = await ethers.getContractFactory(contractName)
  const contract = await contractFactory.deploy(...args)
  await contract.deployed()

  console.log(`${contractName} deployed to: ${contract.address}`)

  return contract
}

async function main (): Promise<void> {
  await deployer('AcmeToken', ethers.utils.parseEther('999'), 'Acme', 'ACM')
  await deployer('MainEscrow')
  await deployer('SideEscrow')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
