import { ethers } from 'hardhat'
import { expect, use } from 'chai'
import { Contract, BigNumber } from 'ethers'
import { solidity, deployContract } from 'ethereum-waffle'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import AcmeToken from '../artifacts/contracts/AcmeToken.sol/AcmeToken.json'
import Utils from '../artifacts/contracts/Utils.sol/Utils.json'

use(solidity)

describe('Bridge', function name () {
  let ownerWallet: SignerWithAddress
  let myWallet: SignerWithAddress
  let acmeToken: Contract
  let bridge: Contract
  const chainId = 1

  beforeEach(async () => {
    [ownerWallet, myWallet] = await ethers.getSigners()
    const utils = await deployContract(ownerWallet, Utils)
    const Bridge = await ethers.getContractFactory('Bridge', {
      libraries: {
        Utils: utils.address
      }
    })
    bridge = await Bridge.deploy(ownerWallet.address)
    await bridge.deployed()

    acmeToken = await deployContract(ownerWallet, AcmeToken, [999, 'Acme', 'ACM'])
  })

  it('Lock emits Lock event', async () => {
    await acmeToken.increaseAllowance(bridge.address, 2)

    await expect(bridge.lock(chainId, acmeToken.address, 2, ownerWallet.address))
      .to.emit(bridge, 'Lock')
      .withArgs(chainId, acmeToken.address, ownerWallet.address, 2, 0)
  })

  it('Lock reduce sender balance', async () => {
    await acmeToken.increaseAllowance(bridge.address, 2)
    await bridge.lock(chainId, acmeToken.address, 2, ownerWallet.address)

    expect(await acmeToken.balanceOf(ownerWallet.address)).to.equal(999 - 2)
  })

  it('Lock from other wallet should reduce sender balance', async () => {
    await acmeToken.transfer(myWallet.address, 7)
    const acmeMyWallet = acmeToken.connect(myWallet)
    await acmeMyWallet.increaseAllowance(bridge.address, 2)
    await bridge.lock(chainId, acmeToken.address, 2, myWallet.address)

    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(7 - 2)
  })

  it('Release emits Release event', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = ownerWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [chainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)

    await acmeToken.increaseAllowance(bridge.address, amount)
    await bridge.lock(chainId, acmeToken.address, amount, ownerWallet.address)

    // test
    await expect(bridge.release(chainId, nativeToken, amount, receiver, txHash, txSigned))
      .to.emit(bridge, 'Release')
      .withArgs(chainId, nativeToken, 2, ownerWallet.address)
  })

  it('Release increase receiver balance', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = myWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [chainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)

    await acmeToken.transfer(myWallet.address, amount)
    const acmeMyWallet = acmeToken.connect(myWallet)
    await acmeMyWallet.increaseAllowance(bridge.address, amount)

    // test
    await bridge.lock(chainId, acmeToken.address, amount, myWallet.address)
    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(0)

    await bridge.release(chainId, nativeToken, amount, receiver, txHash, txSigned)
    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(amount)
  })

  it('Sending Release tx with bad arguments should revert', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = ownerWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [chainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)

    await acmeToken.increaseAllowance(bridge.address, amount)
    await bridge.lock(chainId, acmeToken.address, amount, ownerWallet.address)

    // test
    const badAmount = 3
    await expect(bridge.release(chainId, nativeToken, badAmount, receiver, txHash, txSigned))
      .to.be.revertedWith('Bad args')
  })

  it('Sending Release tx with tx signed by untrusted signer should revert', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = ownerWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [chainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await myWallet.signMessage(txArr)

    await acmeToken.increaseAllowance(bridge.address, amount)
    await bridge.lock(chainId, acmeToken.address, amount, ownerWallet.address)

    // test
    await expect(bridge.release(chainId, nativeToken, amount, receiver, txHash, txSigned))
      .to.be.revertedWith('Bad signer')
  })

  it('Mint emits Mint event', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = ownerWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [chainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)
    await bridge.wrapToken(chainId, nativeToken, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 })

    // test
    await expect(bridge.mint(chainId, nativeToken, amount, receiver, txHash, txSigned))
      .to.emit(bridge, 'Mint')
  })

  it('Mint emits Mint event with valid args', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = ownerWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [chainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)
    await bridge.wrapToken(chainId, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 })

    // test
    const tx = await bridge.mint(chainId, nativeToken, amount, receiver, txHash, txSigned)
    const receipt = await tx.wait()
    expect(receipt.events[1].args[0]).to.be.properAddress
    expect(BigNumber.from(receipt.events[1].args[1]).toString()).to.be.equal(amount.toString())
    expect(receipt.events[1].args[2]).to.be.equal(receiver)
  })

  it('Mint with unsupported token should be reverted', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = ownerWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [chainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)

    // test
    await expect(bridge.mint(chainId, nativeToken, amount, receiver, txHash, txSigned))
      .to.be.revertedWith('Wrap first')
  })

  it('Mint mints new tokens', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = myWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [chainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)
    await bridge.wrapToken(chainId, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 })
    await bridge.mint(chainId, nativeToken, amount, receiver, txHash, txSigned)
    const wrappedToken = await bridge._wrappedTokens(0)
    const token = new ethers.Contract(wrappedToken.token, AcmeToken.abi, myWallet)

    // test
    expect(await token.balanceOf(myWallet.address)).to.equal(amount)
    expect(await token.totalSupply()).to.equal(amount)
  })

  it('Burn emits Burn event', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = myWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [chainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)
    await bridge.wrapToken(chainId, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 })
    await bridge.mint(chainId, nativeToken, amount, receiver, txHash, txSigned)
    const wrappedToken = await bridge._wrappedTokens(0)
    const token = new ethers.Contract(wrappedToken.token, AcmeToken.abi, myWallet)
    await token.increaseAllowance(bridge.address, amount)

    // test
    await expect(bridge.burn(token.address, amount, receiver))
      .to.emit(bridge, 'Burn')
      .withArgs(token.address, amount, myWallet.address)
  })

  it('Burn burns sent amount', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = myWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [chainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)
    await bridge.wrapToken(chainId, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 })
    await bridge.mint(chainId, nativeToken, amount, receiver, txHash, txSigned)
    const wrappedToken = await bridge._wrappedTokens(0)
    const token = new ethers.Contract(wrappedToken.token, AcmeToken.abi, myWallet)
    await token.increaseAllowance(bridge.address, amount)

    expect(await token.totalSupply()).to.equal(amount)
    await bridge.burn(token.address, amount, receiver)
    expect(await token.totalSupply()).to.equal(0)
  })

  it('Wrapping already wrapped token should revert', async () => {
    await bridge.wrapToken(chainId, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 })

    await expect(bridge.wrapToken(chainId, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 }))
      .to.be.revertedWith('Already wrapped')
  })

  it('Wrapping token with empty name should revert', async () => {
    await expect(bridge.wrapToken(chainId, acmeToken.address, { name: '', symbol: 'wACM', decimals: 18 }))
      .to.be.revertedWith('Bad name')
  })

  it('Wrapping token with empty symbol should revert', async () => {
    await expect(bridge.wrapToken(chainId, acmeToken.address, { name: 'wrapped Acme', symbol: '', decimals: 18 }))
      .to.be.revertedWith('Bad symbol')
  })

  it('Wrapping token with chainId = 0 should revert', async () => {
    await expect(bridge.wrapToken(0, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 }))
      .to.be.revertedWith('Bad chain id')
  })

  it('Wrapping token should return proper address', async () => {
    expect(await bridge.callStatic.wrapToken(chainId, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 })).to.be.properAddress
  })

  it('Wrapping token should emit WrappedTokenDeployed', async () => {
    await expect(bridge.wrapToken(chainId, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 }))
      .to.emit(bridge, 'WrappedTokenDeployed')
  })

  it('Wrapped tokens array should contain valid data', async () => {
    const tokenParams = {
      name: 'wrapped Acme',
      symbol: 'wACM',
      decimals: 18
    }
    const nativeToken = acmeToken.address
    await bridge.wrapToken(chainId, nativeToken, tokenParams)
    const token = await bridge._wrappedTokens(0)

    expect(token.name).to.equal(tokenParams.name)
    expect(token.symbol).to.equal(tokenParams.symbol)
    expect(token.nativeToken).to.equal(nativeToken)
    expect(token.nativeChain).to.equal(chainId)
  })

  it('Sending ETH should reverts', async () => {
    const twoEth = ethers.utils.parseEther('2')
    const tx = {
      to: bridge.address,
      value: twoEth
    }

    await expect(myWallet.sendTransaction(tx)).to.be.revertedWith('Reverted')
  })
})
