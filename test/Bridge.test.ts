import { ethers } from 'hardhat'
import { expect, use } from 'chai'
import { Contract } from 'ethers'
import { solidity, deployContract } from 'ethereum-waffle'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { JsonRpcProvider } from '@ethersproject/providers'

import AcmeToken from '../artifacts/contracts/AcmeToken.sol/AcmeToken.json'
import Bridge from '../artifacts/contracts/Bridge.sol/Bridge.json'

use(solidity)

describe('Bridge', function name () {
  let ownerWallet: SignerWithAddress
  let myWallet: SignerWithAddress
  let acmeToken: Contract
  let bridge: Contract
  let rnToken: Contract
  let provider: JsonRpcProvider

  beforeEach(async () => {
    [ownerWallet, myWallet] = await ethers.getSigners()
    provider = ethers.provider
    bridge = await deployContract(ownerWallet, Bridge)
    acmeToken = await deployContract(ownerWallet, AcmeToken, [999, 'Acme', 'ACM'])
    rnToken = await deployContract(ownerWallet, AcmeToken, [1, 'Random', 'RN'])
    await bridge.addNewERC20('Acme', 'ACM')
  })

  it('Sending ETH should reverts', async () => {
    const twoEth = ethers.utils.parseEther('2')
    const tx = {
      to: bridge.address,
      value: twoEth
    }

    await expect(myWallet.sendTransaction(tx)).to.be.revertedWith('Bridging ETH is not supported')
  })

  it('Sending ETH should not increases bridge contract balance', async () => {
    const twoEth = ethers.utils.parseEther('2')
    const tx = {
      to: bridge.address,
      value: twoEth
    }

    await expect(myWallet.sendTransaction(tx)).to.be.revertedWith('Bridging ETH is not supported')
    expect(await provider.getBalance(bridge.address)).to.equal(0)
  })

  it('Lock emits LockSuccess event', async () => {
    await acmeToken.increaseAllowance(bridge.address, 2)

    await expect(bridge.lock(acmeToken.address, 2))
      .to.emit(bridge, 'LockSuccess')
      .withArgs(ownerWallet.address, acmeToken.address, 2)
  })

  it('Lock reduce sender balance', async () => {
    await acmeToken.increaseAllowance(bridge.address, 2)
    await bridge.lock(acmeToken.address, 2)

    expect(await acmeToken.balanceOf(ownerWallet.address)).to.equal(999 - 2)
  })

  it('Lock from other wallet should reduce sender balance', async () => {
    await acmeToken.transfer(myWallet.address, 7)
    const acmeMyWallet = acmeToken.connect(myWallet)
    await acmeMyWallet.increaseAllowance(bridge.address, 2)
    const escrowMyWallet = bridge.connect(myWallet)
    await escrowMyWallet.lock(acmeToken.address, 2)

    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(7 - 2)
  })

  it('Release emits ReleaseSuccess event', async () => {
    await acmeToken.increaseAllowance(bridge.address, 2)
    await bridge.lock(acmeToken.address, 2)

    await expect(bridge.release(acmeToken.address, 2))
      .to.emit(bridge, 'ReleaseSuccess')
      .withArgs(ownerWallet.address, 2)
  })

  it('Release increase sender balance', async () => {
    // setup
    await acmeToken.transfer(myWallet.address, 2)
    const acmeMyWallet = acmeToken.connect(myWallet)
    await acmeMyWallet.increaseAllowance(bridge.address, 2)
    const escrowMyWallet = bridge.connect(myWallet)
    await escrowMyWallet.lock(acmeToken.address, 2)
    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(0)

    // test
    await escrowMyWallet.release(acmeToken.address, 2)
    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(2)
  })

  it('Mint with unsupported token should be reverted', async () => {
    await expect(bridge.mint(rnToken.address, myWallet.address, 7))
      .to.be.revertedWith('Not supported token')
  })

  it('Mint emits MintSuccess event', async () => {
    const addresses = await bridge.supportedTokens()
    await expect(bridge.mint(addresses[0], myWallet.address, 7))
      .to.emit(bridge, 'MintSuccess')
      .withArgs(myWallet.address, 7)
  })

  it('Mint mints new tokens', async () => {
    const addresses = await bridge.supportedTokens()
    const token = new ethers.Contract(addresses[0], AcmeToken.abi, myWallet)
    await bridge.mint(token.address, myWallet.address, 7)

    expect(await token.balanceOf(myWallet.address)).to.equal(7)
    expect(await token.totalSupply()).to.equal(7)
  })

  it('Burn emits BurnSuccess event', async () => {
    const addresses = await bridge.supportedTokens()
    const token = new ethers.Contract(addresses[0], AcmeToken.abi, ownerWallet)
    await bridge.mint(token.address, ownerWallet.address, 7)
    await token.increaseAllowance(bridge.address, 7)

    await expect(bridge.burn(token.address, 7))
      .to.emit(bridge, 'BurnSuccess')
      .withArgs(ownerWallet.address, 7)
  })

  it('Burn burns sent amount', async () => {
    const addresses = await bridge.supportedTokens()
    const token = new ethers.Contract(addresses[0], AcmeToken.abi, ownerWallet)
    await bridge.mint(token.address, ownerWallet.address, 7)
    await token.increaseAllowance(bridge.address, 7)

    expect(await token.totalSupply()).to.equal(7)
    await bridge.burn(token.address, 7)
    expect(await token.totalSupply()).to.equal(0)
  })

  it('Can Burn from other wallet', async () => {
    const addresses = await bridge.supportedTokens()
    const token = new ethers.Contract(addresses[0], AcmeToken.abi, myWallet)
    await bridge.mint(token.address, myWallet.address, 7)
    await token.increaseAllowance(bridge.address, 7)
    const escrowMyWallet = bridge.connect(myWallet)

    expect(await token.totalSupply()).to.equal(7)
    await escrowMyWallet.burn(token.address, 7)
    expect(await token.totalSupply()).to.equal(0)
  })

  it('Burn from other wallet emits BurnSuccess event', async () => {
    const addresses = await bridge.supportedTokens()
    const token = new ethers.Contract(addresses[0], AcmeToken.abi, myWallet)
    await bridge.mint(token.address, myWallet.address, 7)
    await token.increaseAllowance(bridge.address, 7)
    const escrowMyWallet = bridge.connect(myWallet)

    await expect(escrowMyWallet.burn(token.address, 7))
      .to.emit(bridge, 'BurnSuccess')
      .withArgs(myWallet.address, 7)
  })

  it('Adding duplicate token should revert', async () => {
    await expect(bridge.addNewERC20('Acme', 'ACM'))
      .to.be.revertedWith('Duplicate names not allowed')
  })

  it('Adding new token should emit AddNewERC20Success', async () => {
    await expect(bridge.addNewERC20('NewToken', 'NEW'))
      .to.emit(bridge, 'AddNewERC20Success')
  })

  it('Adding new token should increase supported tokens list', async () => {
    await bridge.addNewERC20('NewToken', 'NEW')
    const tokens = await bridge.supportedTokens()
    expect(tokens.length).to.equal(2)
  })
})
