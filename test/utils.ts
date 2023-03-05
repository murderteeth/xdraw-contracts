import { ethers } from "hardhat"
import addresses from '../addresses.json'

export const maxUint256 = '115792089237316195423570985008687907853269984665640564039457584007913129639935'

export const nEth = (n: number) => {
  return ethers.utils.parseEther(n.toString())
}

export const oneEth = nEth(1)

const toBytes32 = (bn: any) => {
  return ethers.utils.hexlify(ethers.utils.zeroPad(bn.toHexString(), 32))
}

const setStorageAt = async (address: any, index: any, value: any) => {
  await ethers.provider.send("hardhat_setStorageAt", [address, index, value])
  await ethers.provider.send("evm_mine", [])
}

export const fakeDaiBalance = async (address: any, amount: any) => {
  const slot = 2
  const index = ethers.utils.solidityKeccak256(
    ['uint256', 'uint256'],
    [address, slot])
  await setStorageAt(
    addresses.hardhat.dai, 
    index, toBytes32(amount).toString())
}
