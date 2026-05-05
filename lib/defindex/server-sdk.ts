import { DefindexSDK } from '@defindex/sdk'
import {
  getDefindexApiKey,
  getDefindexBaseUrl,
  getDefindexSupportedNetwork,
} from './config'

let instance: DefindexSDK | null = null

export function getServerDefindexSdk(): DefindexSDK {
  if (!instance) {
    instance = new DefindexSDK({
      apiKey: getDefindexApiKey(),
      baseUrl: getDefindexBaseUrl(),
      defaultNetwork: getDefindexSupportedNetwork(),
    })
  }
  return instance
}
