import { BigNumber } from 'ethers'
import hre, { ethers, network } from 'hardhat'
import addresses from '../addresses.json'

async function main() {
  await hre.run('clean')
  await hre.run('compile')

  const [owner] = await ethers.getSigners()
  const dai = addresses[network.name as keyof typeof addresses].dai
  const yvdai = addresses[network.name as keyof typeof addresses].yvdai
  const usdToCreditRateBps = 100

  console.log('network', network.name)
  console.log('dai', dai)
  console.log('yvdai', yvdai)

  const creditsFactory = await ethers.getContractFactory('Credits')
  const credits = await creditsFactory.deploy(usdToCreditRateBps, dai)
  await credits.deployed()
  await credits.grantRole(await credits.SPENDER_ROLE(), owner.address)
  console.log('credits', credits.address)

  const treasuryFactory = await ethers.getContractFactory('Treasury')
  const treasury = await treasuryFactory.deploy(dai)
  await treasury.deployed()
  await credits.grantRole(await credits.REWARD_ROLE(), treasury.address)
  await treasury.setCredits(credits.address)
  await credits.approve(treasury.address, BigNumber.from(2).pow(256).sub(1))
  await treasury.setVault(yvdai)
  console.log('treasury', treasury.address)

  const drawingsFactory = await ethers.getContractFactory('Drawings')
  const drawings = await drawingsFactory.deploy()
  await drawings.setCredits(credits.address)
  await credits.grantRole(await credits.SPENDER_ROLE(), drawings.address)
  console.log('drawings', drawings.address)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
