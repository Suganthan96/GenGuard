"use client"

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { BrowserProvider } from "ethers"
import {
  DUPLICATE_GALILEO_NETWORK_HELP,
  is0gGalileo,
  OG_GALILEO,
} from "@/lib/chain-0g"
import { getInjectedProvider } from "@/lib/get-injected-provider"

type WalletContextValue = {
  address: string | null
  chainId: bigint | null
  connecting: boolean
  error: string | null
  is0gNetwork: boolean
  connect: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

/** MetaMask / Rabby often reject with a plain object, not `instanceof Error`. */
function walletErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message

  const o = err as {
    message?: string
    code?: number
    data?: { message?: string }
  }
  if (typeof o?.message === "string" && o.message.trim()) return o.message
  if (typeof o?.data?.message === "string" && o.data.message.trim()) {
    return o.data.message
  }

  const code = o?.code
  if (code === 4001) return "Request rejected in wallet."
  if (code === 4100) return "Wallet: unauthorized — unlock MetaMask and try again."
  if (code === -32002) return "A wallet request is already open — check the MetaMask extension popup."
  if (code === -32603) return "Wallet internal error — try again or restart the MetaMask extension."

  if (typeof err === "string" && err.trim()) return err

  try {
    const s = JSON.stringify(err)
    if (s && s !== "{}") return s.slice(0, 280)
  } catch {
    /* ignore */
  }

  return "Could not connect wallet."
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<bigint | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refreshChain = useCallback(async () => {
    const eth = getInjectedProvider()
    if (!eth) return
    try {
      const provider = new BrowserProvider(eth)
      const net = await provider.getNetwork()
      setChainId(net.chainId)
    } catch {
      setChainId(null)
    }
  }, [])

  const refreshAccounts = useCallback(async () => {
    const eth = getInjectedProvider()
    if (!eth) return
    try {
      const provider = new BrowserProvider(eth)
      const accounts = (await provider.send("eth_accounts", [])) as string[]
      setAddress(accounts[0] ?? null)
      await refreshChain()
    } catch {
      setAddress(null)
    }
  }, [refreshChain])

  useEffect(() => {
    void refreshAccounts()
    const eth = getInjectedProvider()
    if (!eth?.on) return
    const onAccounts = (accs: string[]) => setAddress(accs[0] ?? null)
    const onChain = () => void refreshChain()
    eth.on("accountsChanged", onAccounts)
    eth.on("chainChanged", onChain)
    return () => {
      eth.removeListener?.("accountsChanged", onAccounts)
      eth.removeListener?.("chainChanged", onChain)
    }
  }, [refreshAccounts, refreshChain])

  const ensure0gGalileo = useCallback(
    async (eth: NonNullable<ReturnType<typeof getInjectedProvider>>) => {
      try {
        await eth.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: OG_GALILEO.chainIdHex }],
        })
        return
      } catch (e: unknown) {
        const code = (e as { code?: number })?.code
        if (code === 4001) throw e
        if (code !== 4902) throw e
      }

      try {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: OG_GALILEO.chainIdHex,
              chainName: OG_GALILEO.name,
              nativeCurrency: OG_GALILEO.nativeCurrency,
              rpcUrls: [OG_GALILEO.rpcUrl],
              blockExplorerUrls: [OG_GALILEO.explorer],
            },
          ],
        })
      } catch (addErr: unknown) {
        const m = walletErrorMessage(addErr).toLowerCase()
        if (
          m.includes("same rpc") ||
          m.includes("points to same") ||
          m.includes("0x40d9") ||
          m.includes("16601")
        ) {
          throw new Error(DUPLICATE_GALILEO_NETWORK_HELP)
        }
        throw addErr
      }

      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: OG_GALILEO.chainIdHex }],
      })
    },
    []
  )

  const connect = useCallback(async () => {
    setError(null)
    setConnecting(true)
    try {
      if (typeof window === "undefined") {
        throw new Error("Wallet is only available in the browser.")
      }

      if (!window.isSecureContext) {
        throw new Error(
          "Wallets need a secure page (HTTPS or http://localhost). If you opened this via a LAN IP, use http://localhost:3000 instead."
        )
      }

      const eth = getInjectedProvider()
      if (!eth) {
        throw new Error(
          "No injected wallet (window.ethereum). Install MetaMask, pin the extension, allow access for this site, then refresh."
        )
      }

      const raw = await eth.request({
        method: "eth_requestAccounts",
        params: [],
      })

      const accounts = Array.isArray(raw) ? (raw as string[]) : []
      const addr = accounts[0]
      if (!addr) {
        throw new Error("Wallet returned no accounts. Unlock MetaMask and try again.")
      }

      let provider = new BrowserProvider(eth)
      const net = await provider.getNetwork()
      if (!is0gGalileo(net.chainId)) {
        await ensure0gGalileo(eth)
        // New chain id invalidates the old BrowserProvider (ethers v6 NETWORK_ERROR).
        provider = new BrowserProvider(eth)
      }

      const net2 = await provider.getNetwork()
      setChainId(net2.chainId)
      setAddress(addr)
    } catch (err: unknown) {
      setError(walletErrorMessage(err))
      setAddress(null)
      setChainId(null)
    } finally {
      setConnecting(false)
    }
  }, [ensure0gGalileo])

  const disconnect = useCallback(() => {
    setAddress(null)
    setChainId(null)
    setError(null)
  }, [])

  const value = useMemo<WalletContextValue>(
    () => ({
      address,
      chainId,
      connecting,
      error,
      is0gNetwork: is0gGalileo(chainId ?? undefined),
      connect,
      disconnect,
    }),
    [address, chainId, connecting, error, connect, disconnect]
  )

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  )
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) {
    throw new Error("useWallet must be used within WalletProvider")
  }
  return ctx
}
