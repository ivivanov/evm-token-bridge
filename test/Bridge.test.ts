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
  const sourceChainId = 1
  const targetChainId = 2
  const serviceFeeWei = 1000000000000000 // 0.001 eth

  beforeEach(async () => {
    [ownerWallet, myWallet] = await ethers.getSigners()
    const utils = await deployContract(ownerWallet, Utils)
    const Bridge = await ethers.getContractFactory('Bridge', {
      libraries: {
        Utils: utils.address
      }
    })
    bridge = await Bridge.deploy(ownerWallet.address, serviceFeeWei)
    await bridge.deployed()

    acmeToken = await deployContract(ownerWallet, AcmeToken, [999, 'Acme', 'ACM'])
  })

  it('Lock emits Lock event', async () => {
    await acmeToken.increaseAllowance(bridge.address, 2)

    await expect(bridge.lock(targetChainId, acmeToken.address, 2, { value: serviceFeeWei }))
      .to.emit(bridge, 'Lock')
      .withArgs(targetChainId, acmeToken.address, ownerWallet.address, 2, serviceFeeWei)
  })

  it('Lock reduce sender balance', async () => {
    await acmeToken.increaseAllowance(bridge.address, 2)
    await bridge.lock(targetChainId, acmeToken.address, 2, { value: serviceFeeWei })

    expect(await acmeToken.balanceOf(ownerWallet.address)).to.equal(999 - 2)
  })

  it('Lock from other wallet should reduce sender balance', async () => {
    await acmeToken.transfer(myWallet.address, 7)
    const acmeMyWallet = acmeToken.connect(myWallet)
    await acmeMyWallet.increaseAllowance(bridge.address, 2)
    const bridgeMyWallet = bridge.connect(myWallet)
    await bridgeMyWallet.lock(targetChainId, acmeToken.address, 2, { value: serviceFeeWei })

    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(7 - 2)
  })

  it('Release emits Release event', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = ownerWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [sourceChainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)

    await acmeToken.increaseAllowance(bridge.address, amount)
    await bridge.lock(targetChainId, acmeToken.address, amount, { value: serviceFeeWei })

    // test
    await expect(bridge.release(sourceChainId, nativeToken, amount, receiver, txHash, txSigned))
      .to.emit(bridge, 'Release')
      .withArgs(sourceChainId, nativeToken, 2, ownerWallet.address)
  })

  it('Release increase receiver balance', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = myWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [sourceChainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)

    await acmeToken.transfer(myWallet.address, amount)
    const acmeMyWallet = acmeToken.connect(myWallet)
    await acmeMyWallet.increaseAllowance(bridge.address, amount)

    // test
    const bridgeMyWallet = bridge.connect(myWallet)
    await bridgeMyWallet.lock(targetChainId, acmeToken.address, amount, { value: serviceFeeWei })
    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(0)

    await bridgeMyWallet.release(sourceChainId, nativeToken, amount, receiver, txHash, txSigned)
    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(amount)
  })

  it('Release non existing token on this network should revert', async () => {
    // setup
    const randomTokenAddress = '0xE8faB2F0E07fc8b0cee83e1cA47d0c0eD53f7A2b'
    const amount = 2
    const receiver = ownerWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [sourceChainId, randomTokenAddress, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)

    // test
    await expect(bridge.release(sourceChainId, randomTokenAddress, amount, receiver, txHash, txSigned))
      .to.be.revertedWith('Token does not exist')
  })

  it('Sending Release tx with bad arguments should revert', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = ownerWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [sourceChainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)

    await acmeToken.increaseAllowance(bridge.address, amount)
    await bridge.lock(targetChainId, acmeToken.address, amount, { value: serviceFeeWei })

    // test
    const badAmount = 3
    await expect(bridge.release(sourceChainId, nativeToken, badAmount, receiver, txHash, txSigned))
      .to.be.revertedWith('Bad args')
  })

  it('Sending Release tx with tx signed by untrusted signer should revert', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = ownerWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [sourceChainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await myWallet.signMessage(txArr)

    await acmeToken.increaseAllowance(bridge.address, amount)
    await bridge.lock(targetChainId, acmeToken.address, amount, { value: serviceFeeWei })

    // test
    await expect(bridge.release(sourceChainId, nativeToken, amount, receiver, txHash, txSigned))
      .to.be.revertedWith('Bad signer')
  })

  it('Mint emits Mint event', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = ownerWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [sourceChainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)
    await bridge.wrapToken(sourceChainId, nativeToken, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 })

    // test
    await expect(bridge.mint(sourceChainId, nativeToken, amount, receiver, txHash, txSigned))
      .to.emit(bridge, 'Mint')
  })

  it('Mint emits Mint event with valid args', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = ownerWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [sourceChainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)
    await bridge.wrapToken(sourceChainId, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 })

    // test
    const tx = await bridge.mint(sourceChainId, nativeToken, amount, receiver, txHash, txSigned)
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
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [sourceChainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)

    // test
    await expect(bridge.mint(sourceChainId, nativeToken, amount, receiver, txHash, txSigned))
      .to.be.revertedWith('Wrap first')
  })

  it('Mint mints new tokens', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = ownerWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [sourceChainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)
    await bridge.wrapToken(sourceChainId, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 })
    await bridge.mint(sourceChainId, nativeToken, amount, receiver, txHash, txSigned)
    const allTokens = await bridge.wrappedTokens()
    const wrappedToken = allTokens[0]
    const token = new ethers.Contract(wrappedToken.wrappedToken, AcmeToken.abi, ownerWallet)

    // test
    expect(await token.balanceOf(receiver)).to.equal(amount)
    expect(await token.totalSupply()).to.equal(amount)
  })

  it('Burn emits Burn event', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = ownerWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [sourceChainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)
    await bridge.wrapToken(sourceChainId, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 })
    await bridge.mint(sourceChainId, nativeToken, amount, receiver, txHash, txSigned)
    const allTokens = await bridge.wrappedTokens()
    const wrappedToken = allTokens[0]
    const token = new ethers.Contract(wrappedToken.wrappedToken, AcmeToken.abi, ownerWallet)
    await token.increaseAllowance(bridge.address, amount)

    // test
    await expect(bridge.burn(sourceChainId, token.address, amount, receiver))
      .to.emit(bridge, 'Burn')
      .withArgs(token.address, amount, receiver)
  })

  it('Burn burns allowed amount', async () => {
    // setup
    const nativeToken = acmeToken.address
    const amount = 2
    const receiver = ownerWallet.address
    const txHash = ethers.utils.solidityKeccak256(['uint16', 'address', 'uint256', 'address'], [sourceChainId, nativeToken, amount, receiver])
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)
    await bridge.wrapToken(sourceChainId, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 })
    await bridge.mint(sourceChainId, nativeToken, amount, receiver, txHash, txSigned)
    const allTokens = await bridge.wrappedTokens()
    const wrappedToken = allTokens[0]
    const token = new ethers.Contract(wrappedToken.wrappedToken, AcmeToken.abi, ownerWallet)
    await token.increaseAllowance(bridge.address, amount)

    expect(await token.totalSupply()).to.equal(2)
    await bridge.burn(sourceChainId, token.address, amount, receiver)
    expect(await token.totalSupply()).to.equal(0)
  })

  it('Wrapping already wrapped token should revert', async () => {
    await bridge.wrapToken(sourceChainId, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 })

    await expect(bridge.wrapToken(sourceChainId, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 }))
      .to.be.revertedWith('Already wrapped')
  })

  it('Wrapping token with empty name should revert', async () => {
    await expect(bridge.wrapToken(sourceChainId, acmeToken.address, { name: '', symbol: 'wACM', decimals: 18 }))
      .to.be.revertedWith('Bad name')
  })

  it('Wrapping token with empty symbol should revert', async () => {
    await expect(bridge.wrapToken(sourceChainId, acmeToken.address, { name: 'wrapped Acme', symbol: '', decimals: 18 }))
      .to.be.revertedWith('Bad symbol')
  })

  it('Wrapping token with invalid chainId should revert', async () => {
    await expect(bridge.wrapToken(0, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 }))
      .to.be.revertedWith('Bad chain id')
  })

  it('Wrapping token should return proper address', async () => {
    expect(await bridge.callStatic.wrapToken(sourceChainId, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 })).to.be.properAddress
  })

  it('Wrapping token should emit WrappedTokenDeployed', async () => {
    await expect(bridge.wrapToken(sourceChainId, acmeToken.address, { name: 'wrapped Acme', symbol: 'wACM', decimals: 18 }))
      .to.emit(bridge, 'WrappedTokenDeployed')
  })

  it('WrappedTokens should contain valid data', async () => {
    const tokenParams = {
      name: 'wrapped Acme',
      symbol: 'wACM',
      decimals: 18
    }
    const nativeToken = acmeToken.address
    await bridge.wrapToken(sourceChainId, nativeToken, tokenParams)
    const allTokens = await bridge.wrappedTokens()
    const token = allTokens[0]

    expect(allTokens.length).to.equal(1)
    expect(token.name).to.equal(tokenParams.name)
    expect(token.symbol).to.equal(tokenParams.symbol)
    expect(token.token).to.equal(nativeToken)
    expect(token.sourceChain).to.equal(sourceChainId)
  })

  it('TokenToWrappedToken should return wrapped token address', async () => {
    const tokenParams = {
      name: 'wrapped Acme',
      symbol: 'wACM',
      decimals: 18
    }
    const nativeToken = acmeToken.address
    await bridge.wrapToken(sourceChainId, nativeToken, tokenParams)
    const allTokens = await bridge.wrappedTokens()
    const wrappedToken = allTokens[0]
    const wrappedTokenAddress = await bridge.tokenToWrappedToken(nativeToken)

    expect(wrappedTokenAddress).to.equal(wrappedToken.wrappedToken)
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
