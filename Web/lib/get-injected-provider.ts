/**
 * Resolve the EIP-1193 provider for MetaMask / multi-wallet setups.
 * @see https://docs.metamask.io/wallet/reference/multiprovider/
 */
export type InjectedProvider = NonNullable<Window["ethereum"]> & {
  isMetaMask?: boolean
  providers?: InjectedProvider[]
}

export function getInjectedProvider(): InjectedProvider | undefined {
  if (typeof window === "undefined") return undefined
  const e = window.ethereum as InjectedProvider | undefined
  if (!e?.request) return undefined

  const list = e.providers
  if (Array.isArray(list) && list.length > 0) {
    const metamask = list.find(
      (p) => p.isMetaMask === true && typeof p.request === "function"
    )
    if (metamask) return metamask as InjectedProvider
  }

  if (e.isMetaMask === true) return e

  if (Array.isArray(list) && list.length > 0) {
    const first = list.find((p) => typeof p.request === "function")
    if (first) return first as InjectedProvider
  }

  return e
}

export function hasInjectedProvider(): boolean {
  return getInjectedProvider() !== undefined
}
