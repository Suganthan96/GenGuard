/**
 * AXL Intent Client
 * Broadcasts agent intents to guardian nodes via AXL network
 */

import axios from 'axios';
import { clearVerdictSpool, drainStrayVerdicts } from './verdict-spool.js';
import { axlBodyToJson, axlRecvFetch } from './axl-recv-util.js';

export class IntentBroadcaster {
  constructor(axlApiUrl = 'http://127.0.0.1:9002') {
    this.axlApiUrl = axlApiUrl;
    this.guardianPeers = []; // Will be populated with guardian public keys
  }

  /**
   * Initialize by discovering guardian nodes from topology
   */
  async initialize() {
    try {
      const response = await axios.get(`${this.axlApiUrl}/topology`);
      const topology = response.data;
      
      console.log(`[intent-client] Connected to AXL node`);
      console.log(`[intent-client] Our public key: ${topology.our_public_key}`);
      console.log(`[intent-client] Connected peers: ${topology.peers.length}`);
      
      return topology;
    } catch (error) {
      throw new Error(`Failed to connect to AXL: ${error.message}`);
    }
  }

  /**
   * Register guardian peer IDs to broadcast to
   */
  registerGuardians(guardianPeerIds) {
    this.guardianPeers = guardianPeerIds;
    console.log(`[intent-client] Registered ${guardianPeerIds.length} guardians`);
  }

  /**
   * Broadcast intent to all registered guardians
   * Returns array of send results
   */
  async broadcastIntent(intent) {
    if (this.guardianPeers.length === 0) {
      throw new Error('No guardians registered. Call registerGuardians() first.');
    }

    console.log(`[intent-client] Broadcasting intent to ${this.guardianPeers.length} guardians`);
    
    // Create A2A-style envelope for intent
    const intentMessage = {
      type: 'guardmesh_intent',
      timestamp: Date.now(),
      intent: intent
    };

    const results = [];
    
    for (const peerId of this.guardianPeers) {
      try {
        const response = await axios.post(
          `${this.axlApiUrl}/send`,
          JSON.stringify(intentMessage),
          {
            headers: {
              'X-Destination-Peer-Id': peerId,
              'Content-Type': 'application/json'
            }
          }
        );
        
        const sentBytes = response.headers['x-sent-bytes'];
        results.push({
          peerId,
          success: true,
          sentBytes: parseInt(sentBytes)
        });
        
        console.log(`[intent-client] ✓ Sent to guardian ${peerId.substring(0, 8)}... (${sentBytes} bytes)`);
      } catch (error) {
        results.push({
          peerId,
          success: false,
          error: error.message
        });
        
        console.error(`[intent-client] ✗ Failed to send to ${peerId.substring(0, 8)}...: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Poll for verdict responses from guardians
   * Returns array of verdicts or null if none available
   */
  async pollVerdicts(timeoutMs = 5000) {
    const verdicts = [];
    const seen = new Set();
    const startTime = Date.now();

    console.log(`[intent-client] Polling for verdicts (timeout: ${timeoutMs}ms)...`);

    const pushVerdict = (fromPeerId, verdictMessage) => {
      if (!verdictMessage?.verdict?.verdict) return;
      const fp = fromPeerId || 'unknown';
      const dedupe = `${fp}:${verdictMessage.timestamp}:${verdictMessage.verdict.verdict}`;
      if (seen.has(dedupe)) return;
      seen.add(dedupe);
      const v = { ...verdictMessage.verdict };
      if (verdictMessage.tee_verified !== undefined) {
        v.tee_verified = verdictMessage.tee_verified;
      }
      verdicts.push({
        peerId: fp,
        verdict: v,
        timestamp: verdictMessage.timestamp,
      });
      console.log(
        `[intent-client] ✓ Received verdict from ${fp.substring(0, 8)}...: ${verdictMessage.verdict.verdict}`
      );
    };

    while (Date.now() - startTime < timeoutMs) {
      for (const row of drainStrayVerdicts()) {
        pushVerdict(row.peerId, {
          verdict: row.verdict,
          timestamp: row.timestamp,
          tee_verified: row.verdict.tee_verified,
        });
      }

      try {
        const { status, fromPeerId, bodyText } = await axlRecvFetch(this.axlApiUrl);

        if (status === 200) {
          const verdictMessage = axlBodyToJson(bodyText);
          if (verdictMessage?.type === 'guardmesh_verdict') {
            pushVerdict(fromPeerId, verdictMessage);
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`[intent-client] Error polling: ${msg}`);
      }

      if (verdicts.length >= this.guardianPeers.length) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`[intent-client] Collected ${verdicts.length} verdicts`);
    return verdicts;
  }

  /**
   * Broadcast intent and wait for verdicts (convenience method)
   */
  async broadcastAndCollect(intent, timeoutMs = 5000) {
    clearVerdictSpool();
    const sendResults = await this.broadcastIntent(intent);
    const verdicts = await this.pollVerdicts(timeoutMs);
    
    return {
      sendResults,
      verdicts
    };
  }
}

export default IntentBroadcaster;
