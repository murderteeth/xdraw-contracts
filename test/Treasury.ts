import chai, { expect } from 'chai'
import chaiBN from 'chai-bn'
import { ethers } from 'hardhat'
import { smock } from '@defi-wonderland/smock'
import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers'
import abi from '../abi'
import addresses from '../addresses.json'
import { fakeDaiBalance, maxUint256, nEth, oneEth } from './utils'
import { Credits__factory, Treasury__factory } from '../typechain-types'
import { BigNumber } from 'ethers'

chai.use(chaiBN(BigNumber))
chai.use(smock.matchers)

describe('Treasury', function () {
  async function deployTreasury() {
    const [owner, user, rando] = await ethers.getSigners()
    const usdToCreditRateBps = 100
    const dai = (new ethers.Contract(addresses.hardhat.dai, abi.erc20)).connect(owner)
    const yvDaiVault = (new ethers.Contract(addresses.hardhat.yvdai, abi.vault)).connect(owner)

    const creditsFactory = await smock.mock<Credits__factory>('Credits')
    const credits = await creditsFactory.deploy(usdToCreditRateBps, addresses.hardhat.dai)
    await credits.grantRole(await credits.SPENDER_ROLE(), owner.address)

    const treasuryFactory = await smock.mock<Treasury__factory>('Treasury')
    const treasury = await treasuryFactory.deploy(addresses.hardhat.dai)

    await credits.grantRole(await credits.REWARD_ROLE(), treasury.address)
    await treasury.setCredits(credits.address)
    expect(await treasury.credits()).to.eq(credits.address)
    await credits.approve(treasury.address, maxUint256)
    await treasury.setVault(yvDaiVault.address)
    expect(await treasury.vault()).to.eq(yvDaiVault.address)

    return {
      dai,
      yvDaiVault,
      credits,
      treasury,
      user,
      owner,
      rando
    }
  }

  it('Approves spenders', async function () {
    const { dai, treasury, rando } = await loadFixture(deployTreasury)
    await treasury.approve(rando.address, maxUint256)
    expect(await dai.allowance(treasury.address, rando.address))
    .to.eq(maxUint256)
  })

  it('Collects cash with no profits', async function () {
    const { dai, credits, treasury, user } = await loadFixture(deployTreasury)
    await fakeDaiBalance(credits.address, oneEth)
    await credits.setVariables({
      totalMinted: nEth(100),
      totalSpent: 0
    })

    await treasury.collect()
    expect(await dai.balanceOf(treasury.address))
    .to.eq(oneEth)
    expect(await treasury.earmarkedForProfit()).to.eq(0)
  })

  it('Collects cash with profits', async function () {
    const { dai, credits, treasury, user } = await loadFixture(deployTreasury)
    await fakeDaiBalance(credits.address, oneEth)
    await credits.setVariables({
      totalMinted: nEth(100),
      totalSpent: nEth(50)
    })
    await treasury.collect()
    expect(await dai.balanceOf(treasury.address))
    .to.eq(oneEth)
    expect(ethers.utils.formatEther(await treasury.earmarkedForProfit())).to.eq('0.5')
  })

  it('Deposits into vault', async function () {
    const { yvDaiVault, treasury } = await loadFixture(deployTreasury)
    await fakeDaiBalance(treasury.address, oneEth)
    await treasury.approve(yvDaiVault.address, oneEth)
    expect(await yvDaiVault.balanceOf(treasury.address)).to.eq(0)
    await treasury.deposit({gasLimit: 1_000_000})
    expect(await yvDaiVault.balanceOf(treasury.address)).to.be.gt(0)
  })

  it('Computes vault position', async function () {
    const { dai, yvDaiVault, treasury } = await loadFixture(deployTreasury)
    await fakeDaiBalance(treasury.address, oneEth)
    await treasury.approve(yvDaiVault.address, oneEth)
    await treasury.deposit({gasLimit: 1_000_000})
    expect(await treasury.vaultPosition()).to.be.closeTo(oneEth, 10)
    await fakeDaiBalance(yvDaiVault.address, (await dai.balanceOf(yvDaiVault.address)).mul(100))
    expect(await treasury.vaultPosition()).to.be.gt(oneEth)
  })

  it('Computes rewards', async function () {
    const { yvDaiVault, credits, treasury, user } = await loadFixture(deployTreasury)
    await fakeDaiBalance(treasury.address, nEth(2))
    await treasury.approve(yvDaiVault.address, nEth(2))
    await treasury.deposit({gasLimit: 1_000_000})
    await treasury.setVariables({
      creditsMintedAsOfLastCollection: nEth(100),
      creditsSpentAsOfLastCollection: 0,
      claimedRewards: { [user.address]: 0 }
    })
    await credits.setVariables({
      minted: { [user.address]: nEth(100) },
      totalMinted: nEth(100)
    })
    expect(await treasury.availableRewards(user.address)).to.be.closeTo(oneEth, 10)
    await credits.setVariable('minted', { [user.address]: nEth(50) })
    expect(await treasury.availableRewards(user.address)).to.be.closeTo(oneEth.div(2), 10)
    await treasury.setVariable('earmarkedForProfit', nEth(2))
    expect(await treasury.availableRewards(user.address)).to.eq(0)
  })

  it('Claims rewards', async function () {
    const { yvDaiVault, credits, treasury, user } = await loadFixture(deployTreasury)
    await fakeDaiBalance(treasury.address, nEth(2))
    await treasury.approve(yvDaiVault.address, nEth(2))
    await treasury.deposit({gasLimit: 1_000_000})
    await treasury.setVariables({
      creditsMintedAsOfLastCollection: nEth(100),
      creditsSpentAsOfLastCollection: 0,
      claimedRewards: { [user.address]: 0 }
    })
    await credits.setVariables({
      minted: { [user.address]: nEth(100) },
      totalMinted: nEth(100)
    })
    await treasury.connect(user).claimRewards()
    expect(await credits.balanceOf(user.address)).to.be.closeTo(nEth(200), 10**12)
    expect(await treasury.availableRewards(user.address)).to.eq(0)
  })

  it('Withdraws everything from vault', async function () {
    const { dai, yvDaiVault, treasury } = await loadFixture(deployTreasury)
    await fakeDaiBalance(treasury.address, oneEth)
    await treasury.approve(yvDaiVault.address, maxUint256)
    await treasury.deposit({gasLimit: 1_000_000})
    await treasury.withdraw({gasLimit: 1_000_000})
    expect(await dai.balanceOf(treasury.address)).to.be.closeTo(oneEth, 10**10)
    expect(await yvDaiVault.balanceOf(treasury.address)).to.eq(0)
  })

  it('Withdraws earmarked profits from vault', async function () {
    const { dai, yvDaiVault, treasury } = await loadFixture(deployTreasury)
    await fakeDaiBalance(treasury.address, oneEth)
    await treasury.approve(yvDaiVault.address, maxUint256)
    await treasury.deposit({gasLimit: 1_000_000})
    await treasury.setVariable('earmarkedForProfit', 0)
    await treasury.withdrawProfit({gasLimit: 1_000_000})
    expect(await dai.balanceOf(treasury.address)).to.eq(0)
    await treasury.setVariable('earmarkedForProfit', oneEth)
    await treasury.withdrawProfit({gasLimit: 1_000_000})
    expect(await dai.balanceOf(treasury.address)).to.be.closeTo(oneEth, 10)
  })

  it('Claims profit', async function () {
    const { dai, treasury, owner } = await loadFixture(deployTreasury)
    await fakeDaiBalance(owner.address, ethers.utils.parseEther('0'))
    await fakeDaiBalance(treasury.address, oneEth)
    await treasury.setVariable('earmarkedForProfit', oneEth)
    await treasury.claimProfit()
    expect(ethers.utils.formatEther(await dai.balanceOf(owner.address))).to.eq('1.0')
    expect(ethers.utils.formatEther(await treasury.earmarkedForProfit())).to.eq('0.0')
  })

  it('Reverts vault change if there\'s still a balance', async function () {
    const { yvDaiVault, treasury } = await loadFixture(deployTreasury)
    await fakeDaiBalance(treasury.address, oneEth)
    await treasury.approve(yvDaiVault.address, maxUint256)
    await treasury.deposit({gasLimit: 1_000_000})
    await expect(treasury.setVault('0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE'))
    .to.be.revertedWith('!0')
  })
})
