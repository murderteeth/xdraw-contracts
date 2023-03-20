import * as dotenv from 'dotenv'
import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import 'hardhat-tracer'

dotenv.config()

const accounts = process.env.PRIVATE_KEY
  ? [process.env.PRIVATE_KEY] : []

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.12',
    settings: {
      outputSelection: {
        "*": {
          "*": ["storageLayout"]
        }
      },
      optimizer: {
        enabled: true,
        runs: 200,
      },
    }
  },
  networks: {
    hardhat: {
      loggingEnabled: false,
      allowUnlimitedContractSize: true,
      forking: {
        url: process.env.MAINNET || ''
      }
    },
    mainnet: {
      url: process.env.MAINNET || '',
      accounts
    },
    opera: {
      url: process.env.OPERA || '',
      accounts
    }
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.APIKEY_MAINNET || '',
      polygon: process.env.APIKEY_POLYGON || '',
      opera: process.env.APIKEY_OPERA || ''
    }
  }
}

export default config
