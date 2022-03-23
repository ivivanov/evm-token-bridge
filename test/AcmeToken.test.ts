import { ethers } from 'hardhat'
import { expect, use } from 'chai'
import { Contract } from 'ethers'
import { solidity, deployContract } from 'ethereum-waffle'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import AcmeToken from '../artifacts/contracts/AcmeToken.sol/AcmeToken.json'

use(solidity)

describe('AcmeToken', function name () {
  let wallet: SignerWithAddress
  let walletTo: SignerWithAddress
  let acmeToken: Contract

  beforeEach(async () => {
    [wallet, walletTo] = await ethers.getSigners()
    acmeToken = await deployContract(wallet, AcmeToken, [1000, 'Random', 'RN'])
  })

  it('Assigns initial balance', async () => {
    expect(await acmeToken.balanceOf(wallet.address)).to.equal(1000)
  })

  it('Transfer adds amount to destination address', async () => {
    await acmeToken.transfer(walletTo.address, 7)
    expect(await acmeToken.balanceOf(walletTo.address)).to.equal(7)
  })

  it('Transfer emits event', async () => {
    await expect(acmeToken.transfer(walletTo.address, 7))
      .to.emit(acmeToken, 'Transfer')
      .withArgs(wallet.address, walletTo.address, 7)
  })

  it('Can not transfer above the amount', async () => {
    await expect(acmeToken.transfer(walletTo.address, 1007)).to.be.reverted
  })

  it('Can not transfer from empty account', async () => {
    const tokenFromOtherWallet = acmeToken.connect(walletTo)
    await expect(tokenFromOtherWallet.transfer(wallet.address, 1))
      .to.be.reverted
  })

  it('Can transfer from other account', async () => {
    await acmeToken.transfer(walletTo.address, 7)
    const tokenFromOtherWallet = acmeToken.connect(walletTo)
    await tokenFromOtherWallet.transfer(wallet.address, 1)
    expect(await acmeToken.balanceOf(walletTo.address)).to.equal(6)
    expect(await acmeToken.balanceOf(wallet.address)).to.equal(1000 - 6)
  })
})
