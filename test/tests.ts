import { expect, use } from 'chai'
import { ethers } from 'ethers'
import { solidity, deployContract, MockProvider } from 'ethereum-waffle'

import AcmeToken from '../artifacts/contracts/AcmeToken.sol/AcmeToken.json'
import Escrow from '../artifacts/contracts/Escrow.sol/Escrow.json'

use(solidity)

describe('Escrow', function name () {
  const [wallet] = new MockProvider().getWallets()
  // const walletPK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  // const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545')
  // const wallet = new ethers.Wallet(walletPK, provider)

  let acmeToken: ethers.Contract
  let escrow: ethers.Contract

  beforeEach(async () => {
    acmeToken = await deployContract(wallet, AcmeToken, [1000])
    escrow = await deployContract(wallet, Escrow)
  })

  it('Transfer adds amount to destination address', async function () {
    await acmeToken.transfer(escrow.address, 7)
    expect(await acmeToken.balanceOf(escrow.address)).to.equal(7)
  })

  it('Transfer emits LockSuccess event', async () => {
    await expect(acmeToken.transfer(escrow.address, 7))
      .to.emit(escrow, 'LockSuccess')
      .withArgs(wallet.address, escrow.address, 7)
  })
})

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

  it('Calls totalSupply on AcmeToken contract', async () => {
    await acmeToken.totalSupply()
    expect('totalSupply').to.be.calledOnContract(acmeToken)
  })

  it('Calls balanceOf with sender address on AcmeToken contract', async () => {
    await acmeToken.balanceOf(wallet.address)
    expect('balanceOf').to.be.calledOnContractWith(acmeToken, [wallet.address])
  })
})
