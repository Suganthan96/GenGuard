"use client"

import { useCallback, useMemo, useState } from "react"
import { BrowserProvider, type TransactionRequest } from "ethers"
import { useWallet } from "@/contexts/wallet-context"
import { getInjectedProvider } from "@/lib/get-injected-provider"
import {
  getAuditContract,
  getReadonlyProvider,
  getRegistryContract,
} from "@/lib/guardmesh-contracts"
import { formatContractError, waitForTxConfirmed } from "@/lib/tx-utils"
import { is0gGalileo } from "@/lib/chain-0g"
import { toast } from "sonner"

export function useGuardmeshContracts() {
  const { address, is0gNetwork } = useWallet()
  const [registryTxBusy, setRegistryTxBusy] = useState(false)

  const readonly = useMemo(() => getReadonlyProvider(), [])

  const registryRead = useMemo(() => getRegistryContract(readonly), [readonly])
  const auditRead = useMemo(() => getAuditContract(readonly), [readonly])

  const getSigner = useCallback(async () => {
    const eth = getInjectedProvider()
    if (!eth) throw new Error("Connect a wallet first.")
    const bp = new BrowserProvider(eth)
    const net = await bp.getNetwork()
    if (!is0gGalileo(net.chainId)) {
      throw new Error("Switch MetaMask to 0G Galileo testnet (chain 16602).")
    }
    return bp.getSigner()
  }, [])

  /**
   * Build a populated tx with `reg.someMethod.populateTransaction(...)`, not `someMethod(...)`.
   * Direct contract calls use JsonRpcSigner.sendTransaction, which polls MetaMask’s RPC
   * (getTransaction / wait → getTransactionReceipt) and throws uncaught RPC errors when the node 500s.
   */
  const runRegistryTx = useCallback(
    async (
      label: string,
      fn: (reg: ReturnType<typeof getRegistryContract>) => Promise<TransactionRequest>
    ) => {
      setRegistryTxBusy(true)
      const loadingId = toast.loading("Confirm in MetaMask…")
      try {
        const signer = await getSigner()
        const reg = getRegistryContract(signer)
        toast.loading("Waiting for confirmation…", { id: loadingId })
        const txReq = await fn(reg)
        const hash = await signer.sendUncheckedTransaction(txReq)
        if (hash) {
          await waitForTxConfirmed(hash)
        }
        toast.dismiss(loadingId)
        toast.success(label)
        return true
      } catch (e) {
        toast.dismiss(loadingId)
        toast.error(formatContractError(e))
        return false
      } finally {
        setRegistryTxBusy(false)
      }
    },
    [getSigner]
  )

  return {
    address,
    is0gNetwork,
    registryRead,
    auditRead,
    getSigner,
    runRegistryTx,
    registryTxBusy,
    formatError: formatContractError,
  }
}
