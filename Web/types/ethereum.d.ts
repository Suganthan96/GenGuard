declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean
      providers?: Array<{
        isMetaMask?: boolean
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
        on?: (event: string, handler: (...args: unknown[]) => void) => void
        removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
      }>
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
      on?: (event: string, handler: (...args: unknown[]) => void) => void
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
    }
  }
}

export {}
