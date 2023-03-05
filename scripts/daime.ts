import { ethers, network } from 'hardhat'
import abi from '../abi'
import addresses from '../addresses.json'
import { fakeDaiBalance } from '../test/utils'

async function main() {
  const [owner] = await ethers.getSigners()

  const dai = new ethers.Contract(
    addresses[network.name as keyof typeof addresses].dai, 
    abi.erc20, 
    owner
  )

  console.log('network', network.name)
  console.log('dai', dai.address)
  await fakeDaiBalance(owner.address, ethers.utils.parseEther('1000'))
  console.log('dai.balanceOf(owner.address)', await dai.balanceOf(owner.address))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
