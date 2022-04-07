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
  const sourceChainId: number = 1
  const targetChainId: number = 2
  const serviceFeeWei: string = process.env.SERVICE_FEE ?? '0'
  const amountWei: string = '1000000000000000' // 0.001 eth
  const acmeInitialBalance = '999000000000000000000' // 999 eth

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

    acmeToken = await deployContract(ownerWallet, AcmeToken, [acmeInitialBalance, 'Acme', 'ACM'])
  })

  const prepareMintTx = async (sourceChain: number, token: string, amountWei: string, receiver: string, wrappedTokenName: string, wrappedTokenSymbol: string) => {
    const txHash = ethers.utils.solidityKeccak256(
      ['uint16', 'address', 'uint256', 'address', 'string', 'string'],
      [sourceChain, token, amountWei, receiver, wrappedTokenName, wrappedTokenSymbol]
    )
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)

    return {
      sourceChain: sourceChain,
      token: token,
      amount: amountWei,
      receiver: receiver,
      wrappedTokenName: wrappedTokenName,
      wrappedTokenSymbol: wrappedTokenSymbol,
      txHash: txHash,
      txSigned: txSigned
    }
  }

  const prepareReleaseTx = async (sourceChain: number, token: string, amountWei: string, receiver: string) => {
    const txHash = ethers.utils.solidityKeccak256(
      ['uint16', 'address', 'uint256', 'address'],
      [sourceChain, token, amountWei, receiver]
    )
    const txArr = ethers.utils.arrayify(txHash)
    const txSigned = await ownerWallet.signMessage(txArr)

    return {
      sourceChain: sourceChain,
      token: token,
      amount: amountWei,
      receiver: receiver,
      txHash: txHash,
      txSigned: txSigned
    }
  }

  it('Lock emits Lock event', async () => {
    await acmeToken.increaseAllowance(bridge.address, amountWei)

    await expect(bridge.lock(targetChainId, acmeToken.address, amountWei, { value: serviceFeeWei }))
      .to.emit(bridge, 'Lock')
      .withArgs(targetChainId, acmeToken.address, ownerWallet.address, amountWei, serviceFeeWei)
  })

  it('Lock reduce sender balance', async () => {
    await acmeToken.increaseAllowance(bridge.address, amountWei)
    await bridge.lock(targetChainId, acmeToken.address, amountWei, { value: serviceFeeWei })
    const initialBalance = BigNumber.from(acmeInitialBalance)
    const amount = BigNumber.from(amountWei)

    expect(await acmeToken.balanceOf(ownerWallet.address)).to.equal(initialBalance.sub(amount))
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
    await acmeToken.increaseAllowance(bridge.address, amountWei)
    await bridge.lock(targetChainId, acmeToken.address, amountWei, { value: serviceFeeWei })
    const releaseTx = await prepareReleaseTx(sourceChainId, acmeToken.address, amountWei, ownerWallet.address)

    // test
    await expect(bridge.release(releaseTx))
      .to.emit(bridge, 'Release')
      .withArgs(sourceChainId, acmeToken.address, amountWei, ownerWallet.address)
  })

  it('Release increase receiver balance', async () => {
    await acmeToken.transfer(myWallet.address, amountWei)
    const acmeMyWallet = acmeToken.connect(myWallet)
    await acmeMyWallet.increaseAllowance(bridge.address, amountWei)

    const releaseTx = await prepareReleaseTx(sourceChainId, acmeToken.address, amountWei, myWallet.address)
    const bridgeMyWallet = bridge.connect(myWallet)

    await bridgeMyWallet.lock(targetChainId, acmeToken.address, amountWei, { value: serviceFeeWei })
    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(0)

    await bridgeMyWallet.release(releaseTx)
    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(amountWei)
  })

  it('Release non existing token on this network should revert', async () => {
    const randomTokenAddress = '0xE8faB2F0E07fc8b0cee83e1cA47d0c0eD53f7A2b'
    const releaseTx = await prepareReleaseTx(sourceChainId, randomTokenAddress, amountWei, ownerWallet.address)

    await expect(bridge.release(releaseTx))
      .to.be.revertedWith('Token does not exist')
  })

  it('Release tx with bad arguments should revert', async () => {
    await acmeToken.increaseAllowance(bridge.address, amountWei)
    await bridge.lock(targetChainId, acmeToken.address, amountWei, { value: serviceFeeWei })

    const releaseTx = await prepareReleaseTx(sourceChainId, acmeToken.address, amountWei, myWallet.address)
    releaseTx.amount = '1'

    await expect(bridge.release(releaseTx))
      .to.be.revertedWith('Bad args')
  })

  it('Release tx with tx signed by untrusted signer should revert', async () => {
    const releaseTx = await prepareReleaseTx(sourceChainId, acmeToken.address, amountWei, myWallet.address)
    const txArr = ethers.utils.arrayify(releaseTx.txHash)
    const txSigned = await myWallet.signMessage(txArr)
    releaseTx.txSigned = txSigned

    await acmeToken.increaseAllowance(bridge.address, amountWei)
    await bridge.lock(targetChainId, acmeToken.address, amountWei, { value: serviceFeeWei })

    // test
    await expect(bridge.release(releaseTx))
      .to.be.revertedWith('Bad signer')
  })

  it('Mint emits Mint event', async () => {
    const mintTx = await prepareMintTx(sourceChainId, acmeToken.address, amountWei, ownerWallet.address, 'name', 'symbol')

    await expect(bridge.mint(mintTx))
      .to.emit(bridge, 'Mint')
  })

  it('Mint emits WrappedTokenDeployed event', async () => {
    const mintTx = await prepareMintTx(sourceChainId, acmeToken.address, amountWei, ownerWallet.address, 'name', 'symbol')

    await expect(bridge.mint(mintTx))
      .to.emit(bridge, 'WrappedTokenDeployed')
  })

  // todo its worth checking event arguments separately
  // const tx = await tokenInstance.connect(<signer-account>).transfer(<addr-of-recipient>, <amount-BigNumber>);
  // const receipt = await ethers.provider.getTransactionReceipt(tx.hash);
  // const interface = new ethers.utils.Interface(["event Transfer(address indexed from, address indexed to, uint256 amount)"]);
  // const data = receipt.logs[0].data;
  // const topics = receipt.logs[0].topics;
  // const event = interface.decodeEventLog("Transfer", data, topics);
  // expect(event.from).to.equal(<addr-of-signer-account>);
  // expect(event.to).to.equal(<addr-of-recipient>);
  // expect(event.amount.toString()).to.equal(<amount-BigNumber>.toString());

  // it('Mint emits Mint event with valid args', async () => {
  //   const mintTx = await prepareMintTx(sourceChainId,acmeToken.address, amountWei, ownerWallet.address, 'name', 'symbol')
  //   const tx = await bridge.mint(mintTx)
  //   const receipt = await tx.wait()

  //   expect(receipt.events[1].args[0]).to.be.properAddress
  //   expect(BigNumber.from(receipt.events[1].args[1]).toString()).to.be.equal(amountWei.toString())
  //   expect(receipt.events[1].args[2]).to.be.equal(ownerWallet.address)
  // })

  it('Mint mints new tokens', async () => {
    const mintTx = await prepareMintTx(sourceChainId, acmeToken.address, amountWei, ownerWallet.address, 'name', 'symbol')
    await bridge.mint(mintTx)
    const allTokens = await bridge.wrappedTokens()
    const wrappedToken = allTokens[0]
    const token = new ethers.Contract(wrappedToken.wrappedToken, AcmeToken.abi, ownerWallet)

    // test
    expect(await token.balanceOf(ownerWallet.address)).to.equal(amountWei)
    expect(await token.totalSupply()).to.equal(amountWei)
  })

  it('Minting token with empty name should revert', async () => {
    const mintTx = await prepareMintTx(sourceChainId, acmeToken.address, amountWei, ownerWallet.address, '', 'symbol')

    await expect(bridge.mint(mintTx)).to.be.revertedWith('Bad name')
  })

  it('Minting token with empty symbol should revert', async () => {
    const mintTx = await prepareMintTx(sourceChainId, acmeToken.address, amountWei, ownerWallet.address, 'name', '')

    await expect(bridge.mint(mintTx)).to.be.revertedWith('Bad symbol')
  })

  it('Minting token with invalid source chain id should revert', async () => {
    const mintTx = await prepareMintTx(0, acmeToken.address, amountWei, ownerWallet.address, 'name', 'symbol')

    await expect(bridge.mint(mintTx)).to.be.revertedWith('Bad chain id')
  })

  it('Mint tx with bad arguments should revert', async () => {
    const mintTx = await prepareMintTx(sourceChainId, acmeToken.address, amountWei, ownerWallet.address, 'name', 'symbol')
    mintTx.amount = '1'

    await expect(bridge.mint(mintTx))
      .to.be.revertedWith('Bad args')
  })

  it('Mint tx with tx signed by untrusted signer should revert', async () => {
    const mintTx = await prepareMintTx(sourceChainId, acmeToken.address, amountWei, ownerWallet.address, 'name', 'symbol')
    const txArr = ethers.utils.arrayify(mintTx.txHash)
    const txSigned = await myWallet.signMessage(txArr)
    mintTx.txSigned = txSigned

    await expect(bridge.mint(mintTx))
      .to.be.revertedWith('Bad signer')
  })

  it('Burn emits Burn event', async () => {
    const mintTx = await prepareMintTx(sourceChainId, acmeToken.address, amountWei, ownerWallet.address, 'name', 'symbol')
    await bridge.mint(mintTx)
    const allTokens = await bridge.wrappedTokens()
    const wrappedToken = allTokens[0]
    const token = new ethers.Contract(wrappedToken.wrappedToken, AcmeToken.abi, ownerWallet)
    await token.increaseAllowance(bridge.address, amountWei)

    // test
    await expect(bridge.burn(sourceChainId, token.address, amountWei, ownerWallet.address))
      .to.emit(bridge, 'Burn')
      .withArgs(token.address, amountWei, ownerWallet.address)
  })

  it('Burn burns allowed amount', async () => {
    const mintTx = await prepareMintTx(sourceChainId, acmeToken.address, amountWei, ownerWallet.address, 'name', 'symbol')
    await bridge.mint(mintTx)
    const allTokens = await bridge.wrappedTokens()
    const wrappedToken = allTokens[0]
    const token = new ethers.Contract(wrappedToken.wrappedToken, AcmeToken.abi, ownerWallet)
    await token.increaseAllowance(bridge.address, amountWei)

    expect(await token.totalSupply()).to.equal(amountWei)
    await bridge.burn(sourceChainId, token.address, amountWei, ownerWallet.address)
    expect(await token.totalSupply()).to.equal(0)
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
