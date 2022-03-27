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
    const bridgeMyWallet = bridge.connect(myWallet)
    await bridgeMyWallet.lock(acmeToken.address, 2)

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
    await acmeToken.transfer(myWallet.address, 2)
    const acmeMyWallet = acmeToken.connect(myWallet)
    await acmeMyWallet.increaseAllowance(bridge.address, 2)
    const bridgeMyWallet = bridge.connect(myWallet)
    await bridgeMyWallet.lock(acmeToken.address, 2)
    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(0)

    await bridgeMyWallet.release(acmeToken.address, 2)
    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(2)
  })

  it('Mint with unsupported token should be reverted', async () => {
    await expect(bridge.mint(rnToken.address, ownerWallet.address, 7))
      .to.be.revertedWith('Not supported token')
  })

  it('Mint emits MintSuccess event', async () => {
    await bridge.addNewERC20('wrapped Acme', 'wACM', acmeToken.address, 1)
    const wrappedTokens = await bridge.wrappedTokens()

    await expect(bridge.mint(wrappedTokens[0].sourceToken, myWallet.address, 7))
      .to.emit(bridge, 'MintSuccess')
      .withArgs(myWallet.address, 7)
  })

  it('Mint mints new tokens', async () => {
    await bridge.addNewERC20('wrapped Acme', 'wACM', acmeToken.address, 1)
    const wrappedTokens = await bridge.wrappedTokens()
    const token = new ethers.Contract(wrappedTokens[0].token, AcmeToken.abi, myWallet)

    await bridge.mint(wrappedTokens[0].sourceToken, myWallet.address, 7)

    expect(await token.balanceOf(myWallet.address)).to.equal(7)
    expect(await token.totalSupply()).to.equal(7)
  })

  it('Burn emits BurnSuccess event', async () => {
    await bridge.addNewERC20('wrapped Acme', 'wACM', acmeToken.address, 1)
    const wrappedTokens = await bridge.wrappedTokens()
    const token = new ethers.Contract(wrappedTokens[0].token, AcmeToken.abi, ownerWallet)
    await bridge.mint(wrappedTokens[0].sourceToken, ownerWallet.address, 7)
    await token.increaseAllowance(bridge.address, 7)

    await expect(bridge.burn(wrappedTokens[0].sourceToken, 7))
      .to.emit(bridge, 'BurnSuccess')
      .withArgs(ownerWallet.address, 7)
  })

  it('Burn burns sent amount', async () => {
    await bridge.addNewERC20('wrapped Acme', 'wACM', acmeToken.address, 1)
    const wrappedTokens = await bridge.wrappedTokens()
    const token = new ethers.Contract(wrappedTokens[0].token, AcmeToken.abi, ownerWallet)
    await bridge.mint(wrappedTokens[0].sourceToken, ownerWallet.address, 7)
    await token.increaseAllowance(bridge.address, 7)

    expect(await token.totalSupply()).to.equal(7)
    await bridge.burn(wrappedTokens[0].sourceToken, 7)
    expect(await token.totalSupply()).to.equal(0)
  })

  it('Can Burn from other wallet', async () => {
    await bridge.addNewERC20('wrapped Acme', 'wACM', acmeToken.address, 1)
    const wrappedTokens = await bridge.wrappedTokens()
    const token = new ethers.Contract(wrappedTokens[0].token, AcmeToken.abi, myWallet)
    await bridge.mint(wrappedTokens[0].sourceToken, myWallet.address, 7)
    await token.increaseAllowance(bridge.address, 7)
    const bridgeMyWallet = bridge.connect(myWallet)

    expect(await token.totalSupply()).to.equal(7)
    await bridgeMyWallet.burn(wrappedTokens[0].sourceToken, 7)
    expect(await token.totalSupply()).to.equal(0)
  })

  it('Adding duplicate token should revert', async () => {
    await bridge.addNewERC20('wrapped Acme', 'wACM', acmeToken.address, 1)

    await expect(bridge.addNewERC20('rn', 'rn', acmeToken.address, 1))
      .to.be.revertedWith('Token already added')
  })

  it('Adding new token should emit AddNewERC20Success', async () => {
    await expect(bridge.addNewERC20('rn', 'rn', acmeToken.address, 1))
      .to.emit(bridge, 'AddNewERC20Success')
  })

  it('Adding new token should increase wrapped tokens list', async () => {
    await bridge.addNewERC20('wrapped Acme', 'wACM', acmeToken.address, 1)
    const wrappedTokens = await bridge.wrappedTokens()

    expect(wrappedTokens.length).to.equal(1)
    expect
  })

  it('Wrapped tokens array should contain valid data', async () => {
    const name = 'wrapped Acme'
    const symbol = 'wACM'
    const sourceToken = acmeToken.address
    const sourceChainId = 1
    await bridge.addNewERC20(name, symbol, sourceToken, sourceChainId)
    const wrappedTokens = await bridge.wrappedTokens()
    const token = wrappedTokens[0]

    expect(token.name).to.equal(name)
    expect(token.symbol).to.equal(symbol)
    expect(token.sourceToken).to.equal(sourceToken)
    expect(token.sourceChainId).to.equal(sourceChainId)
  })

  it('LockedBalance should return valid data', async () => {
    await acmeToken.increaseAllowance(bridge.address, 2)
    await bridge.lock(acmeToken.address, 2)

    expect(await bridge.lockedBalance(acmeToken.address)).to.equal(2)
  })
})
