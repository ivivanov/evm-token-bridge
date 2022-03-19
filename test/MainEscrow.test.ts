import { expect, use } from 'chai'
import { Contract } from 'ethers'
import { solidity, deployContract, MockProvider } from 'ethereum-waffle'

import AcmeToken from '../artifacts/contracts/AcmeToken.sol/AcmeToken.json'
import MainEscrow from '../artifacts/contracts/MainEscrow.sol/MainEscrow.json'

use(solidity)

describe('MainEscrow', function name () {
  const [ownerWallet, myWallet] = new MockProvider().getWallets()
  let acmeToken: Contract
  let escrow: Contract

  beforeEach(async () => {
    acmeToken = await deployContract(ownerWallet, AcmeToken, [999])
    escrow = await deployContract(ownerWallet, MainEscrow, [acmeToken.address])
  })

  it('Lock emits LockSuccess event', async () => {
    await acmeToken.increaseAllowance(escrow.address, 2)

    await expect(escrow.lock(2))
      .to.emit(escrow, 'LockSuccess')
      .withArgs(ownerWallet.address, escrow.address, 2)
  })

  it('Lock reduce sender balance', async () => {
    await acmeToken.increaseAllowance(escrow.address, 2)
    await escrow.lock(2)

    expect(await acmeToken.balanceOf(ownerWallet.address)).to.equal(999 - 2)
  })

  it('Lock from other wallet should reduce sender balance', async () => {
    await acmeToken.transfer(myWallet.address, 7)
    const acmeMyWallet = acmeToken.connect(myWallet)
    await acmeMyWallet.increaseAllowance(escrow.address, 2)
    const escrowMyWallet = escrow.connect(myWallet)
    await escrowMyWallet.lock(2)

    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(7 - 2)
  })

  it('Release emits ReleaseSuccess event', async () => {
    await acmeToken.increaseAllowance(escrow.address, 2)
    await escrow.lock(2)

    await expect(escrow.release())
      .to.emit(escrow, 'ReleaseSuccess')
      .withArgs(ownerWallet.address, 2)
  })

  it('Release increase sender allowance', async () => {
    await acmeToken.increaseAllowance(escrow.address, 2)
    await escrow.lock(2)
    await escrow.release()

    expect(await acmeToken.allowance(escrow.address, ownerWallet.address)).to.equal(2)
  })

  it('After release should be able to claim tokens', async () => {
    await acmeToken.transfer(myWallet.address, 7)
    const acmeMyWallet = acmeToken.connect(myWallet)
    await acmeMyWallet.increaseAllowance(escrow.address, 2)
    const escrowMyWallet = escrow.connect(myWallet)

    await escrowMyWallet.lock(2)
    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(7 - 2)

    await escrowMyWallet.release()
    expect(await acmeToken.allowance(escrow.address, myWallet.address)).to.equal(2)
    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(7 - 2)

    await acmeMyWallet.transferFrom(escrow.address, myWallet.address, 2)
    expect(await acmeToken.balanceOf(myWallet.address)).to.equal(7)
  })
})
