import { expect } from 'chai'
import { ethers } from 'hardhat'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import addresses from '../addresses.json'
import {maxUint256, fakeDaiBalance, oneEth, nEth} from './utils'
import { smock } from '@defi-wonderland/smock'
import { Credits__factory } from '../typechain-types'
import abi from '../abi'

describe('Credits', function () {
  async function deployCredits() {
    const [owner, user, rando] = await ethers.getSigners()
    const usdToCreditRateBps = 100
    const dai = (new ethers.Contract(addresses.hardhat.dai, abi.erc20)).connect(owner)

    const creditsFactory = await smock.mock<Credits__factory>('Credits')
    const credits = await creditsFactory.deploy(usdToCreditRateBps, addresses.hardhat.dai)
    await credits.grantRole(await credits.SPENDER_ROLE(), owner.address)
    await credits.grantRole(await credits.REWARD_ROLE(), owner.address)

    return {
      dai,
      credits,
      user,
      owner,
      rando
    }
  }

  it('Approves spenders', async function () {
    const { dai, credits, rando } = await loadFixture(deployCredits)
    await credits.approve(rando.address, maxUint256)
    expect(await dai.allowance(credits.address, rando.address))
    .to.eq(maxUint256)
  })

  it('Computes credit to usd conversion', async function () {
    const { credits } = await loadFixture(deployCredits)
    expect(ethers.utils.formatEther(await credits.creditsToUsd(oneEth))).to.eq('0.01')
  })

  it('Computes usd to credit conversion', async function () {
    const { credits } = await loadFixture(deployCredits)
    expect(ethers.utils.formatEther(await credits.usdToCredits(oneEth))).to.eq('100.0')
  })

  it('Reverts if you can\'t afford credits', async function () {
    const { credits, user } = await loadFixture(deployCredits)
    await fakeDaiBalance(user.address, ethers.utils.parseEther('0'))
    await expect(credits.connect(user).buy(oneEth)).to.be.revertedWith('Dai/insufficient-balance')
  })

  it('Sells you credits', async function () {
    const { dai, credits, user } = await loadFixture(deployCredits)
    await fakeDaiBalance(user.address, oneEth)
    await dai.connect(user).approve(credits.address, oneEth)
    await expect(credits.connect(user).buy(nEth(100)))
    .to.emit(credits, 'Buy')
    .withArgs(user.address, nEth(100))
    expect(await credits.balanceOf(user.address)).to.eq(nEth(100))
    expect(await dai.balanceOf(user.address)).to.eq(0)
    expect(await dai.balanceOf(credits.address)).to.eq(oneEth)
  })

  it('Spends credits', async function () {
    const { credits, user } = await loadFixture(deployCredits)
    await credits.setVariable('minted', { [user.address]: nEth(100) })
    await expect(credits.spend(user.address, nEth(100)))
    .to.emit(credits, 'Spend')
    .withArgs(user.address, nEth(100))
    expect(await credits.balanceOf(user.address)).to.eq(0)
  })

  it('Rewards credits', async function () {
    const { credits, user } = await loadFixture(deployCredits)
    await credits.setVariable('minted', { [user.address]: nEth(100) })
    await expect(credits.reward(user.address, oneEth))
    .to.emit(credits, 'Reward')
    .withArgs(user.address, oneEth)
    expect(await credits.balanceOf(user.address)).to.eq(nEth(101))
  })

  it('Computes credit balances', async function () {
    const { credits, user } = await loadFixture(deployCredits)
    await credits.setVariable('minted', { [user.address]: nEth(100) })
    expect(await credits.balanceOf(user.address)).to.eq(nEth(100))
    await credits.setVariable('spent', { [user.address]: nEth(25) })
    expect(await credits.balanceOf(user.address)).to.eq(nEth(75))
    await credits.setVariable('spent', { [user.address]: nEth(100) })
    expect(await credits.balanceOf(user.address)).to.eq(0)
  })

  it('Reverts if you don\'t have enough credits', async function () {
    const { credits, user } = await loadFixture(deployCredits)
    await credits.setVariable('minted', { [user.address]: nEth(100) })
    await expect(credits.spend(user.address, nEth(101)))
    .to.be.revertedWith('!balance')
  })

  it('Transfers ownership', async function () {
    const { credits, owner, rando } = await loadFixture(deployCredits)
    await credits.transferOwnership(rando.address)
    await credits.connect(rando).acceptOwnership()

    expect(await credits.owner())
    .to.eq(rando.address)

    expect(
      await credits.hasRole(
      await credits.DEFAULT_ADMIN_ROLE(), 
      rando.address)
    ).to.eq(true)

    expect(
      await credits.hasRole(
      await credits.DEFAULT_ADMIN_ROLE(), 
      owner.address)
    ).to.eq(false)
  })
})
