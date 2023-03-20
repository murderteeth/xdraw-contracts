import chai, { expect } from 'chai'
import chaiBN from 'chai-bn'
import { ethers } from 'hardhat'
import { smock } from '@defi-wonderland/smock'
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import addresses from '../addresses.json'
import { nEth, oneEth } from './utils'
import { Credits__factory, Drawings__factory } from '../typechain-types'
import { BigNumber } from 'ethers'

chai.use(chaiBN(BigNumber))
chai.use(smock.matchers)

const fake = {
  cid: {
    a: 'QmWATWQ7fVPP2EFGu71UkfnqhYXDYH566qy47CnJDgvs8u',
    b: 'bafybeififz5x77to5hsmeagt5cufv2a7mqxhlomhd2idez2xhf3wdwfani'
  }
}

describe('Drawings', function () {
  async function deployDrawings() {
    const [owner, user] = await ethers.getSigners()
    const usdToCreditRateBps = 100

    const creditsFactory = await smock.mock<Credits__factory>('Credits')
    const credits = await creditsFactory.deploy(usdToCreditRateBps, addresses.hardhat.dai)

    const drawingsFactory = await smock.mock<Drawings__factory>('Drawings')
    const drawings = await drawingsFactory.deploy()
    await drawings.setCredits(credits.address)
    expect(await drawings.credits()).to.eq(credits.address)
    await credits.grantRole(await credits.SPENDER_ROLE(), drawings.address)

    return {
      drawings,
      credits,
      user,
      owner
    }
  }

  it('Reverts if you don\'t have enough credits', async function () {
    const { credits, drawings, user } = await loadFixture(deployDrawings)
    await credits.setVariable('minted', { [user.address]: 0 })
    await expect(drawings.mint(fake.cid.a)).to.revertedWith('!balance')
  })

  it('Mints drawings', async function () {
    const { credits, drawings, user } = await loadFixture(deployDrawings)
    await credits.setVariable('minted', { [user.address]: oneEth })
    await drawings.connect(user).mint(fake.cid.a)
    expect(await drawings.connect(user).tokenURI(1)).to.eq(`ipfs://${fake.cid.a}/meta`)
    expect(await credits.balanceOf(user.address)).to.eq(0)
    expect(await drawings.balanceOf(user.address)).to.eq(1)
  })

  it('Updates cids', async function () {
    const { credits, drawings, user } = await loadFixture(deployDrawings)
    await credits.setVariable('minted', { [user.address]: oneEth })
    await drawings.connect(user).mint(fake.cid.a)
    await drawings.connect(user).update(1, fake.cid.b)
    expect(await drawings.connect(user).tokenURI(1)).to.eq(`ipfs://${fake.cid.b}/meta`)
    expect(await credits.balanceOf(user.address)).to.eq(0)
    expect(await drawings.balanceOf(user.address)).to.eq(1)
  })

  it('Changes credits per drawing', async function () {
    const { drawings } = await loadFixture(deployDrawings)
    expect(await drawings.creditsPerDrawing()).to.eq(oneEth)
    await drawings.setCreditsPerDrawing(nEth(2))
    expect(await drawings.creditsPerDrawing()).to.eq(nEth(2))
  })
})
