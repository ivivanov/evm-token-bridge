import { ethers } from 'hardhat'
import { expect, use } from 'chai'
import { Contract } from 'ethers'
import { solidity, deployContract } from 'ethereum-waffle'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import Utils from '../artifacts/contracts/Utils.sol/Utils.json'

use(solidity)

describe('Utils', function name () {
  let wallet: SignerWithAddress
  let utils: Contract

  beforeEach(async () => {
    [wallet] = await ethers.getSigners()
    utils = await deployContract(wallet, Utils)
  })

  it('Recover Signer From Signed Message should return address', async () => {
    const txHash = ethers.utils.solidityKeccak256(['string'], ['random message'])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await wallet.signMessage(txArr)

    expect(await utils.recoverSignerFromSignedMessage(txHash, txSigned))
      .to.equal(wallet.address)
  })

  it('Hash Args should return valid hash', async () => {
    const sourceChain = 1
    const randomTokenAddress = '0xE8faB2F0E07fc8b0cee83e1cA47d0c0eD53f7A2b'
    const amountWei = '1000000000000000' // 0.001 eth
    const name = 'name'
    const symbol = 'symbol'
    const txHash = ethers.utils.solidityKeccak256(
      ['uint16', 'address', 'uint256', 'address', 'string', 'string'],
      [sourceChain, randomTokenAddress, amountWei, wallet.address, name, symbol]
    )
    expect(await utils.hashArgs(sourceChain, randomTokenAddress, amountWei, wallet.address, name, symbol))
      .to.equal(txHash)
  })

  it('Bytes To Address should return address', async () => {
    const address = wallet.address
    const bytes = ethers.utils.arrayify(address)

    expect(await utils.bytesToAddress(bytes))
      .to.equal(address)
  })

  it('Bytes To Tx Hash should return bytes32', async () => {
    const txHash = ethers.utils.solidityKeccak256(['string'], ['random message'])
    const bytes = ethers.utils.arrayify(txHash)

    expect(await utils.bytesToTxHash(bytes))
      .to.equal(txHash)
  })

  it('Is Contract should return true for existing contract', async () => {
    expect(await utils.isContract(utils.address))
      .to.be.true
  })

  it('Is Contract should return false for non existing contract', async () => {
    const randomTokenAddress = '0xE8faB2F0E07fc8b0cee83e1cA47d0c0eD53f7A2b'

    expect(await utils.isContract(randomTokenAddress))
      .to.be.false
  })
})
