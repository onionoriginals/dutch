/**
 * Tests for Network Configuration
 */

import { describe, test, expect } from 'bun:test'
import {
  type AppNetwork,
  NETWORKS,
  getSupportedNetworks,
  getWalletSupportedNetworks,
  walletNetworkToAppNetwork,
  appNetworkToWalletNetwork,
  validateAddressForNetwork,
  detectNetworkFromAddress,
  getNetworkConfig,
  isNetworkEnabled,
  parseNetworkFromUrl,
  getExplorerTxLink,
  getExplorerAddressLink,
} from './networks'

describe('Network Configuration', () => {
  describe('getSupportedNetworks', () => {
    test('returns all four supported networks', () => {
      const networks = getSupportedNetworks()
      expect(networks).toHaveLength(4)
      expect(networks).toContain('mainnet')
      expect(networks).toContain('testnet')
      expect(networks).toContain('signet')
      expect(networks).toContain('regtest')
    })
  })

  describe('getWalletSupportedNetworks', () => {
    test('excludes regtest from wallet-supported networks', () => {
      const networks = getWalletSupportedNetworks()
      expect(networks).not.toContain('regtest')
      expect(networks).toContain('mainnet')
      expect(networks).toContain('testnet')
      expect(networks).toContain('signet')
    })
  })

  describe('walletNetworkToAppNetwork', () => {
    test('converts wallet network types to app network types', () => {
      expect(walletNetworkToAppNetwork('Mainnet')).toBe('mainnet')
      expect(walletNetworkToAppNetwork('Testnet')).toBe('testnet')
      expect(walletNetworkToAppNetwork('Signet')).toBe('signet')
    })

    test('throws error for unsupported wallet network', () => {
      expect(() => walletNetworkToAppNetwork('Invalid' as any)).toThrow('Unsupported wallet network')
    })
  })

  describe('appNetworkToWalletNetwork', () => {
    test('converts app network to wallet network type', () => {
      expect(appNetworkToWalletNetwork('mainnet')).toBe('Mainnet')
      expect(appNetworkToWalletNetwork('testnet')).toBe('Testnet')
      expect(appNetworkToWalletNetwork('signet')).toBe('Signet')
    })

    test('returns null for regtest', () => {
      expect(appNetworkToWalletNetwork('regtest')).toBe(null)
    })
  })

  describe('validateAddressForNetwork', () => {
    test('validates mainnet addresses', () => {
      expect(validateAddressForNetwork('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'mainnet')).toBe(true)
      expect(validateAddressForNetwork('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'mainnet')).toBe(true)
      expect(validateAddressForNetwork('3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy', 'mainnet')).toBe(true)
      expect(validateAddressForNetwork('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', 'mainnet')).toBe(false)
    })

    test('validates testnet addresses', () => {
      expect(validateAddressForNetwork('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', 'testnet')).toBe(true)
      expect(validateAddressForNetwork('tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkf7ylth7e', 'testnet')).toBe(true)
      expect(validateAddressForNetwork('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'testnet')).toBe(false)
      expect(validateAddressForNetwork('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn', 'testnet')).toBe(true)
    })

    test('validates signet addresses', () => {
      expect(validateAddressForNetwork('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', 'signet')).toBe(true)
      expect(validateAddressForNetwork('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'signet')).toBe(false)
    })

    test('validates regtest addresses', () => {
      expect(validateAddressForNetwork('bcrt1qxy2kgdygjrsqtzq2n0yrf2493p83kkf9gtvw9q', 'regtest')).toBe(true)
      expect(validateAddressForNetwork('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', 'regtest')).toBe(false)
    })
  })

  describe('detectNetworkFromAddress', () => {
    test('detects mainnet from address', () => {
      expect(detectNetworkFromAddress('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh')).toBe('mainnet')
      expect(detectNetworkFromAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe('mainnet')
    })

    test('detects testnet from address', () => {
      expect(detectNetworkFromAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')).toBe('testnet')
      expect(detectNetworkFromAddress('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn')).toBe('testnet')
    })

    test('detects regtest from address', () => {
      expect(detectNetworkFromAddress('bcrt1qxy2kgdygjrsqtzq2n0yrf2493p83kkf9gtvw9q')).toBe('regtest')
    })

    test('returns null for invalid address', () => {
      expect(detectNetworkFromAddress('invalid')).toBe(null)
      expect(detectNetworkFromAddress('')).toBe(null)
    })
  })

  describe('getNetworkConfig', () => {
    test('returns correct config for each network', () => {
      const mainnetConfig = getNetworkConfig('mainnet')
      expect(mainnetConfig.displayName).toBe('Bitcoin Mainnet')
      expect(mainnetConfig.walletType).toBe('Mainnet')
      expect(mainnetConfig.apis.mempool).toBe('https://mempool.space/api')

      const testnetConfig = getNetworkConfig('testnet')
      expect(testnetConfig.displayName).toBe('Bitcoin Testnet')
      expect(testnetConfig.walletType).toBe('Testnet')

      const regtestConfig = getNetworkConfig('regtest')
      expect(regtestConfig.walletType).toBe(null)
    })
  })

  describe('getExplorerTxLink', () => {
    test('generates correct explorer links', () => {
      const txid = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      
      expect(getExplorerTxLink(txid, 'mainnet')).toBe(
        `https://mempool.space/tx/${txid}`
      )
      expect(getExplorerTxLink(txid, 'testnet')).toBe(
        `https://mempool.space/testnet/tx/${txid}`
      )
      expect(getExplorerTxLink(txid, 'signet')).toBe(
        `https://mempool.space/signet/tx/${txid}`
      )
      expect(getExplorerTxLink(txid, 'regtest')).toBe(
        `http://localhost:3002/tx/${txid}`
      )
    })

    test('throws error for invalid txid', () => {
      expect(() => getExplorerTxLink('', 'mainnet')).toThrow('Invalid txid provided')
      expect(() => getExplorerTxLink(null as any, 'mainnet')).toThrow('Invalid txid provided')
    })
  })

  describe('getExplorerAddressLink', () => {
    test('generates correct address links', () => {
      const address = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
      
      expect(getExplorerAddressLink(address, 'mainnet')).toBe(
        `https://mempool.space/address/${address}`
      )
      expect(getExplorerAddressLink(address, 'testnet')).toBe(
        `https://mempool.space/testnet/address/${address}`
      )
    })

    test('throws error for invalid address', () => {
      expect(() => getExplorerAddressLink('', 'mainnet')).toThrow('Invalid address provided')
      expect(() => getExplorerAddressLink(null as any, 'mainnet')).toThrow('Invalid address provided')
    })
  })

  describe('Network-specific configurations', () => {
    test('all networks have required properties', () => {
      getSupportedNetworks().forEach((network) => {
        const config = getNetworkConfig(network)
        expect(config.id).toBe(network)
        expect(config.displayName).toBeTruthy()
        expect(config.shortName).toBeTruthy()
        expect(config.apis.mempool).toBeTruthy()
        expect(config.apis.explorer).toBeTruthy()
        expect(config.addressPrefixes.bech32).toBeInstanceOf(Array)
        expect(config.addressPrefixes.bech32.length).toBeGreaterThan(0)
      })
    })

    test('mainnet, testnet, signet have wallet types', () => {
      expect(NETWORKS.mainnet.walletType).toBe('Mainnet')
      expect(NETWORKS.testnet.walletType).toBe('Testnet')
      expect(NETWORKS.signet.walletType).toBe('Signet')
    })

    test('regtest has no wallet type', () => {
      expect(NETWORKS.regtest.walletType).toBe(null)
    })

    test('production flags are set correctly', () => {
      expect(NETWORKS.mainnet.enabledInProduction).toBe(true)
      expect(NETWORKS.testnet.enabledInProduction).toBe(true)
      expect(NETWORKS.signet.enabledInProduction).toBe(true)
      expect(NETWORKS.regtest.enabledInProduction).toBe(false)
    })
  })

  describe('Address prefix validation', () => {
    test('mainnet uses bc1 prefix', () => {
      expect(NETWORKS.mainnet.addressPrefixes.bech32).toContain('bc1')
    })

    test('testnet and signet use tb1 prefix', () => {
      expect(NETWORKS.testnet.addressPrefixes.bech32).toContain('tb1')
      expect(NETWORKS.signet.addressPrefixes.bech32).toContain('tb1')
    })

    test('regtest uses bcrt1 prefix', () => {
      expect(NETWORKS.regtest.addressPrefixes.bech32).toContain('bcrt1')
    })
  })
})
