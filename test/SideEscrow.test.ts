import { expect, use } from 'chai'
import { Contract } from 'ethers'
import { solidity, deployContract, MockProvider } from 'ethereum-waffle'

import AcmeToken from '../artifacts/contracts/AcmeToken.sol/AcmeToken.json'
import SideEscrow from '../artifacts/contracts/SideEscrow.sol/SideEscrow.json'

use(solidity)

describe('SideEscrow', function name () {
  const [ownerWallet, myWallet] = new MockProvider().getWallets()
  let sideEscrow: Contract
  let acmeToken: Contract

  beforeEach(async () => {
    sideEscrow = await deployContract(ownerWallet, SideEscrow)
    const acmeAddress = await sideEscrow.Acme()
    acmeToken = new Contract(acmeAddress, AcmeToken.abi, ownerWallet)
  })

  it('Initial balance should be 0', async () => {
    expect(await acmeToken.balanceOf(ownerWallet.address)).to.equal(0)
  })

  it('Release emits ReleaseSuccess event', async () => {
    expect(await sideEscrow.release(myWallet.address, 7))
      .to.emit(sideEscrow, 'ReleaseSuccess')
      .withArgs(myWallet.address, 7)
  })

  it('Release mint new tokens', async () => {
    await sideEscrow.release(myWallet.address, 7)
    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(7)
    expect(await acmeToken.totalSupply()).to.equal(7)
  })

  it('Lock emits LockSuccess event', async () => {
    await sideEscrow.release(ownerWallet.address, 7)
    await acmeToken.increaseAllowance(sideEscrow.address, 7)

    await expect(sideEscrow.lock(7))
      .to.emit(sideEscrow, 'LockSuccess')
      .withArgs(ownerWallet.address, 7)
  })

  it('Lock burns sent amount', async () => {
    await sideEscrow.release(ownerWallet.address, 7)
    await acmeToken.increaseAllowance(sideEscrow.address, 7)

    expect(await acmeToken.totalSupply()).to.equal(7)
    await sideEscrow.lock(7)
    expect(await acmeToken.totalSupply()).to.equal(0)
  })

  it('Can Lock from other wallet', async () => {
    await sideEscrow.release(myWallet.address, 7)
    const acmeMyWallet = acmeToken.connect(myWallet)
    const sideEscrowMyWallet = sideEscrow.connect(myWallet)
    await acmeMyWallet.increaseAllowance(sideEscrowMyWallet.address, 7)

    expect(await acmeToken.totalSupply()).to.equal(7)
    await sideEscrowMyWallet.lock(7)
    expect(await acmeToken.totalSupply()).to.equal(0)
  })

  it('Lock from other wallet emits LockSuccess event', async () => {
    await sideEscrow.release(myWallet.address, 7)
    const acmeMyWallet = acmeToken.connect(myWallet)
    const sideEscrowMyWallet = sideEscrow.connect(myWallet)
    await acmeMyWallet.increaseAllowance(sideEscrowMyWallet.address, 7)

    await expect(sideEscrowMyWallet.lock(7))
      .to.emit(sideEscrow, 'LockSuccess')
      .withArgs(myWallet.address, 7)
  })

  // todo implement & test receive, fallback methods
})
