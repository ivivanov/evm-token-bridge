import { expect, use } from 'chai'
import { ethers } from 'ethers'
import { solidity, deployContract, MockProvider } from 'ethereum-waffle'

import AcmeToken from '../artifacts/contracts/AcmeToken.sol/AcmeToken.json'

use(solidity)

describe('AcmeToken', function name () {
  const [wallet, walletTo] = new MockProvider().getWallets()
  let acmeToken: ethers.Contract

  beforeEach(async () => {
    acmeToken = await deployContract(wallet, AcmeToken, [1000])
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

  it('Calls totalSupply on AcmeToken contract', async () => {
    await acmeToken.totalSupply()
    expect('totalSupply').to.be.calledOnContract(acmeToken)
  })

  it('Calls balanceOf with sender address on AcmeToken contract', async () => {
    await acmeToken.balanceOf(wallet.address)
    expect('balanceOf').to.be.calledOnContractWith(acmeToken, [wallet.address])
  })
})
