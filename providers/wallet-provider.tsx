'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

interface WalletInfo {
  address: string
  walletName: string
}

interface WalletContextValue {
  walletInfo: WalletInfo | null
  isConnected: boolean
  setWalletInfo: (address: string, walletName: string) => void
  clearWalletInfo: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

export const useWalletContext = (): WalletContextValue => {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWalletContext must be used within a WalletProvider')
  }
  return context
}

interface WalletProviderProps {
  children: ReactNode
}

export const WalletProvider = ({ children }: WalletProviderProps) => {
  const [walletInfo, setWalletInfoState] = useState<WalletInfo | null>(null)

  const setWalletInfo = useCallback((address: string, walletName: string) => {
    setWalletInfoState({ address, walletName })
  }, [])

  const clearWalletInfo = useCallback(() => {
    setWalletInfoState(null)
  }, [])

  const isConnected = walletInfo !== null

  return (
    <WalletContext.Provider
      value={{ walletInfo, isConnected, setWalletInfo, clearWalletInfo }}
    >
      {children}
    </WalletContext.Provider>
  )
}
