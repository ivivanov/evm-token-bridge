import { ethers } from 'hardhat'
import { expect, use } from 'chai'
import { BigNumber, Contract } from 'ethers'
import { solidity, deployContract } from 'ethereum-waffle'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { JsonRpcProvider } from '@ethersproject/providers'

import AcmeToken from '../artifacts/contracts/AcmeToken.sol/AcmeToken.json'
import MainEscrow from '../artifacts/contracts/MainEscrow.sol/MainEscrow.json'

use(solidity)

describe('MainEscrow', function name () {
  let ownerWallet: SignerWithAddress
  let myWallet: SignerWithAddress
  let acmeToken: Contract
  let escrow: Contract
  let provider: JsonRpcProvider

  beforeEach(async () => {
    [ownerWallet, myWallet] = await ethers.getSigners()
    provider = ethers.provider
    acmeToken = await deployContract(ownerWallet, AcmeToken, [999, 'Acme', 'ACM'])
    escrow = await deployContract(ownerWallet, MainEscrow)
  })

  it('Sending ETH emits LockSuccess event', async () => {
    const twoEth = ethers.utils.parseEther('2')
    const tx = {
      to: escrow.address,
      value: twoEth
    }

    await expect(myWallet.sendTransaction(tx))
      .to.emit(escrow, 'LockSuccess')
      .withArgs(myWallet.address, escrow.address, twoEth)
  })

  it('Sending ETH increases escrow contract balance', async () => {
    const twoEth = ethers.utils.parseEther('2')
    const tx = {
      to: escrow.address,
      value: twoEth
    }
    await myWallet.sendTransaction(tx)

    expect(await provider.getBalance(escrow.address)).to.equal(twoEth)
  })

  it('ReleaseEth emits ReleaseSuccess', async () => {
    const twoEth = ethers.utils.parseEther('2')
    const tx = {
      to: escrow.address,
      value: twoEth
    }
    await ownerWallet.sendTransaction(tx)

    await expect(escrow.releaseEth(twoEth))
      .to.emit(escrow, 'ReleaseSuccess')
      .withArgs(ownerWallet.address, twoEth)
  })

  it('ReleaseEth increase sender balance', async () => {
    const twoEth = ethers.utils.parseEther('2')
    const initialBalance = await provider.getBalance(ownerWallet.address)
    const tx = {
      to: escrow.address,
      value: twoEth
    }
    await ownerWallet.sendTransaction(tx)
    const balanceAfterSend = await provider.getBalance(ownerWallet.address)

    expect(BigNumber.from(balanceAfterSend)).to.be.lt(BigNumber.from(initialBalance.sub(twoEth)))

    await escrow.releaseEth(twoEth)
    const balanceAfterRelease = await provider.getBalance(ownerWallet.address)

    expect(BigNumber.from(balanceAfterRelease)).to.be.lt(BigNumber.from(initialBalance)) // incurred fees
    expect(BigNumber.from(balanceAfterRelease)).to.gt(BigNumber.from(initialBalance.sub(twoEth)))
  })

  it('Lock emits LockSuccess event', async () => {
    await acmeToken.increaseAllowance(escrow.address, 2)

    await expect(escrow.lock(acmeToken.address, 2))
      .to.emit(escrow, 'LockSuccess')
      .withArgs(ownerWallet.address, acmeToken.address, 2)
  })

  it('Lock reduce sender balance', async () => {
    await acmeToken.increaseAllowance(escrow.address, 2)
    await escrow.lock(acmeToken.address, 2)

    expect(await acmeToken.balanceOf(ownerWallet.address)).to.equal(999 - 2)
  })

  it('Lock from other wallet should reduce sender balance', async () => {
    await acmeToken.transfer(myWallet.address, 7)
    const acmeMyWallet = acmeToken.connect(myWallet)
    await acmeMyWallet.increaseAllowance(escrow.address, 2)
    const escrowMyWallet = escrow.connect(myWallet)
    await escrowMyWallet.lock(acmeToken.address, 2)

    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(7 - 2)
  })

  it('Release emits ReleaseSuccess event', async () => {
    await acmeToken.increaseAllowance(escrow.address, 2)
    await escrow.lock(acmeToken.address, 2)

    await expect(escrow.release(acmeToken.address, 2))
      .to.emit(escrow, 'ReleaseSuccess')
      .withArgs(ownerWallet.address, 2)
  })

  it('Release increase sender balance', async () => {
    // setup
    await acmeToken.transfer(myWallet.address, 2)
    const acmeMyWallet = acmeToken.connect(myWallet)
    await acmeMyWallet.increaseAllowance(escrow.address, 2)
    const escrowMyWallet = escrow.connect(myWallet)
    await escrowMyWallet.lock(acmeToken.address, 2)
    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(0)

    // test
    await escrowMyWallet.release(acmeToken.address, 2)
    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(2)
  })
})
