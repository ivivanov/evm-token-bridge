import { expect, use } from 'chai'
import { ethers } from 'ethers'
import { solidity, deployContract, MockProvider } from 'ethereum-waffle'

import AcmeToken from '../artifacts/contracts/AcmeToken.sol/AcmeToken.json'
import Escrow from '../artifacts/contracts/Escrow.sol/Escrow.json'

use(solidity)

describe('Escrow', function name () {
  const [wallet] = new MockProvider().getWallets()
  // const walletPK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
  // const wallet2PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
  // const provider = new ethers.providers.JsonRpcProvider('http://localhost:8545')
  // const wallet = new ethers.Wallet(walletPK, provider)
  // const wallet2 = new ethers.Wallet(wallet2PK, provider)

  let acmeToken: ethers.Contract
  let escrow: ethers.Contract

  beforeEach(async () => {
    acmeToken = await deployContract(wallet, AcmeToken, [999])
    escrow = await deployContract(wallet, Escrow, [acmeToken.address])
  })

  it('Lock emits LockSuccess event', async () => {
    const receipt = await acmeToken.increaseAllowance(escrow.address, 2)
    await receipt.wait()

    expect(await escrow.lock(2))
      .to.emit(escrow, 'LockSuccess')
      .withArgs(wallet.address, escrow.address, 2)
  })

  it('Lock emits LockSuccess event', async () => {
    const receipt = await acmeToken.increaseAllowance(escrow.address, 2)
    await receipt.wait()

    expect(await escrow.lock(2))
      .to.emit(escrow, 'LockSuccess')
      .withArgs(wallet.address, escrow.address, 2)
  })


  it('ClaimAll emits ClaimSuccess event', async () => {
    const receipt = await acmeToken.increaseAllowance(escrow.address, 2)
    await receipt.wait()
    await escrow.lock(2)

    expect(await escrow.claimAll())
      .to.emit(escrow, 'ClaimSuccess')
      .withArgs(wallet.address, 2)
  })


  // it('Claim emits ClaimSuccess event', async () => {
  //   await acmeToken.transfer(wallet2.address, 7) // transfer from owner (wallet)
  //   expect(await acmeToken.balanceOf(wallet2.address)).to.equal(7)

  //   const acmeWallet2 = acmeToken.connect(wallet2)
  //   // await acmeWallet2.transfer(escrow.address, 2)
  //   // expect(await acmeToken.balanceOf(escrow.address)).to.equal(2)

  //   // tokenFromOtherWallet.transfer(escrowTokenAdderess, 1)
  //   // await expect(tokenFromOtherWallet.transfer(escrowTokenAdderess, 1)).to.emit(escrow,'LockSuccess')

  //   const receipt = await acmeWallet2.approve(escrow.address, 2)
  //   await receipt.wait()


  //   // await escrow.Lock(acmeToken.address)
  //   const escrowWallet2 = escrow.connect(wallet2)
  //   expect(await escrowWallet2.lock(acmeWallet2.address, 2))
  //     .to.emit(escrowWallet2, 'LockSuccess')
  //     .withArgs(wallet2.address, escrowWallet2.address, 2)
  // })
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
