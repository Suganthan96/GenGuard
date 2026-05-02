/** One normalized guardian vote after AXL recv or verdict spool drain. */
export type VerdictRow = {
  peerId: string
  verdict: string
  reason?: string
  tee_verified?: boolean
  raw?: unknown
}
