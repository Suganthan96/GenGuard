"use client"

import { WalletProvider } from "@/contexts/wallet-context"
import { Toaster } from "sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      {children}
      <Toaster position="top-center" richColors closeButton />
    </WalletProvider>
  )
}
