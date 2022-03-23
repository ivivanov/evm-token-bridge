import { ethers } from 'hardhat'
import { expect, use } from 'chai'
import { Contract } from 'ethers'
import { solidity, deployContract } from 'ethereum-waffle'

import AcmeToken from '../artifacts/contracts/AcmeToken.sol/AcmeToken.json'
import SideEscrow from '../artifacts/contracts/SideEscrow.sol/SideEscrow.json'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

use(solidity)

describe('SideEscrow', function name () {
  let ownerWallet: SignerWithAddress
  let myWallet: SignerWithAddress
  let sideEscrow: Contract
  let rnToken: Contract

  beforeEach(async () => {
    [ownerWallet, myWallet] = await ethers.getSigners()
    sideEscrow = await deployContract(ownerWallet, SideEscrow)
    await sideEscrow.addNewERC20('Acme', 'ACM')
    rnToken = await deployContract(ownerWallet, AcmeToken, [1, 'Random', 'RN'])
  })

  it('Release with unsupported token should be reverted', async () => {
    await expect(sideEscrow.release(rnToken.address, myWallet.address, 7))
      .to.be.revertedWith('Not supported token')
  })

  it('Release emits ReleaseSuccess event', async () => {
    const addresses = await sideEscrow.supportedTokens()
    await expect(sideEscrow.release(addresses[0], myWallet.address, 7))
      .to.emit(sideEscrow, 'ReleaseSuccess')
      .withArgs(myWallet.address, 7)
  })

  it('Release mint new tokens', async () => {
    const addresses = await sideEscrow.supportedTokens()
    const token = new ethers.Contract(addresses[0], AcmeToken.abi, myWallet)
    await sideEscrow.release(token.address, myWallet.address, 7)

    expect(await token.balanceOf(myWallet.address)).to.equal(7)
    expect(await token.totalSupply()).to.equal(7)
  })

  it('Lock emits LockSuccess event', async () => {
    const addresses = await sideEscrow.supportedTokens()
    const token = new ethers.Contract(addresses[0], AcmeToken.abi, ownerWallet)
    await sideEscrow.release(token.address, ownerWallet.address, 7)
    await token.increaseAllowance(sideEscrow.address, 7)

    await expect(sideEscrow.lock(token.address, 7))
      .to.emit(sideEscrow, 'LockSuccess')
      .withArgs(ownerWallet.address, 7)
  })

  it('Lock burns sent amount', async () => {
    const addresses = await sideEscrow.supportedTokens()
    const token = new ethers.Contract(addresses[0], AcmeToken.abi, ownerWallet)
    await sideEscrow.release(token.address, ownerWallet.address, 7)
    await token.increaseAllowance(sideEscrow.address, 7)

    expect(await token.totalSupply()).to.equal(7)
    await sideEscrow.lock(token.address, 7)
    expect(await token.totalSupply()).to.equal(0)
  })

  it('Can Lock from other wallet', async () => {
    const addresses = await sideEscrow.supportedTokens()
    const token = new ethers.Contract(addresses[0], AcmeToken.abi, myWallet)
    await sideEscrow.release(token.address, myWallet.address, 7)
    await token.increaseAllowance(sideEscrow.address, 7)
    const escrowMyWallet = sideEscrow.connect(myWallet)

    expect(await token.totalSupply()).to.equal(7)
    await escrowMyWallet.lock(token.address, 7)
    expect(await token.totalSupply()).to.equal(0)
  })

  it('Lock from other wallet emits LockSuccess event', async () => {
    const addresses = await sideEscrow.supportedTokens()
    const token = new ethers.Contract(addresses[0], AcmeToken.abi, myWallet)
    await sideEscrow.release(token.address, myWallet.address, 7)
    await token.increaseAllowance(sideEscrow.address, 7)
    const escrowMyWallet = sideEscrow.connect(myWallet)

    await expect(escrowMyWallet.lock(token.address, 7))
      .to.emit(sideEscrow, 'LockSuccess')
      .withArgs(myWallet.address, 7)
  })

  it('Adding duplicate token should revert', async () => {
    await expect(sideEscrow.addNewERC20('Acme', 'ACM'))
      .to.be.revertedWith('Duplicate names not allowed')
  })

  it('Adding new token should emit AddNewERC20Success', async () => {
    await expect(sideEscrow.addNewERC20('NewToken', 'NEW'))
      .to.emit(sideEscrow, 'AddNewERC20Success')
  })

  it('Adding new token should increase supported tokens list', async () => {
    await sideEscrow.addNewERC20('NewToken', 'NEW')
    const tokens = await sideEscrow.supportedTokens()
    expect(tokens.length).to.equal(2)
  })

  // todo implement & test receive, fallback methods
})
