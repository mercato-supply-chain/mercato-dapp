import { DefindexSDK } from '@defindex/sdk'
import {
  getDefindexApiKey,
  getDefindexBaseUrl,
  getDefindexSupportedNetwork,
} from './config'

let instance: DefindexSDK | null = null

/**
 * Lazily construct and cache the server-side DeFindex SDK client.
 * Cached for the process lifetime; call {@link resetServerDefindexSdk} to force a
 * rebuild from current config.
 */
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

/**
 * Clear the cached SDK instance so the next {@link getServerDefindexSdk} call rebuilds
 * it from current config. Enables recovery from a client constructed with bad config
 * (e.g. during a bad deploy) and simplifies unit testing/mocking.
 */
export function resetServerDefindexSdk(): void {
  instance = null
}
