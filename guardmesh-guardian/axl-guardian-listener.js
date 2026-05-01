/**
 * AXL Guardian Listener
 * Listens for intents from AXL network and sends verdicts back
 */

import axios from 'axios';
import GuardianAgent from './guardian.js';
import { appendStrayVerdict } from './verdict-spool.js';
import { axlBodyToJson, axlRecvFetch } from './axl-recv-util.js';

function isAxlConnectionRefused(err) {
  const msg = String(err?.message ?? err?.cause?.message ?? '');
  const code = err?.code ?? err?.cause?.code;
  return code === 'ECONNREFUSED' || msg.includes('ECONNREFUSED');
}

export class GuardianListener {
  constructor(guardianId, axlApiUrl = 'http://127.0.0.1:9002') {
    this.guardianId = guardianId;
    this.axlApiUrl = axlApiUrl;
    this.guardian = null;
    this.running = false;
    this.ourPublicKey = null;
  }


  /**
   * Try to fetch /topology and populate ourPublicKey (e.g. after /recv reconnect).
   * Returns true only when `our_public_key` is a non-empty string.
   */
  async _tryFetchTopology() {
    try {
      const response = await axios.get(`${this.axlApiUrl}/topology`, { timeout: 8000 });
      const topology = response.data;
      const key = topology?.our_public_key;
      if (key == null || String(key).trim() === '') {
        return false;
      }
      this.ourPublicKey = String(key).trim();
      const nPeers = Array.isArray(topology.peers) ? topology.peers.length : 0;
      console.log(`[${this.guardianId}] AXL Public Key: ${this.ourPublicKey}`);
      console.log(`[${this.guardianId}] Connected peers: ${nPeers}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize guardian and AXL connection.
   * Does not return until /topology yields a non-empty our_public_key (AXL must be up).
   */
  async initialize() {
    console.log(`[${this.guardianId}] Initializing Guardian Listener...`);

    // Initialize guardian agent
    this.guardian = new GuardianAgent(this.guardianId);
    await this.guardian.initialize();

    const topologyUrl = `${this.axlApiUrl.replace(/\/$/, '')}/topology`;
    let lastWarn = 0;
    for (;;) {
      try {
        const response = await axios.get(topologyUrl);
        const topology = response.data;
        const key = topology?.our_public_key;
        if (key != null && String(key).trim() !== '') {
          this.ourPublicKey = String(key).trim();
          const nPeers = Array.isArray(topology.peers) ? topology.peers.length : 0;
          console.log(`[${this.guardianId}] AXL Public Key: ${this.ourPublicKey}`);
          console.log(`[${this.guardianId}] Connected peers: ${nPeers}`);
          break;
        }
        console.warn(`[${this.guardianId}] /topology returned empty our_public_key; retrying…`);
      } catch (e) {
        const now = Date.now();
        if (now - lastWarn >= 30_000) {
          lastWarn = now;
          const detail = isAxlConnectionRefused(e)
            ? `AXL HTTP not listening — start the matching axl/start-guardian-*.ps1 for ${this.axlApiUrl}`
            : (e?.message || String(e));
          console.warn(`[${this.guardianId}] ⚠ waiting for ${topologyUrl} (${detail})`);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(`[${this.guardianId}] ✓ Guardian Listener ready`);
    return this.ourPublicKey;
  }

  /**
   * Start listening for intents
   */
  async startListening() {
    this.running = true;
    this._axlDown = false;
    console.log(`[${this.guardianId}] Started listening for intents...`);

    while (this.running) {
      try {
        // Poll /recv with fetch so body is never run through axios JSON.parse
        const { status, fromPeerId, bodyText } = await axlRecvFetch(this.axlApiUrl);

        // AXL node just came back up after being down
        if (this._axlDown) {
          this._axlDown = false;
          console.log(`[${this.guardianId}] ✓ AXL node reconnected`);
          // Re-fetch topology to populate public key if we didn't get it at startup
          if (!this.ourPublicKey) await this._tryFetchTopology();
        }

        if (status === 204) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }

        if (status === 200) {
          const message = axlBodyToJson(bodyText);
          if (!message || typeof message !== 'object') {
            continue;
          }

          if (message.type === 'guardmesh_verdict') {
            appendStrayVerdict({
              type: message.type,
              fromPeerId: fromPeerId || message.guardian_key,
              timestamp: message.timestamp,
              verdict: message.verdict,
              tee_verified: message.tee_verified,
              guardian_key: message.guardian_key,
              policy_used: message.policy_used ?? null,
            });
            continue;
          }

          if (message.type === 'guardmesh_intent') {
            const fp = fromPeerId || 'unknown';
            console.log(`[${this.guardianId}] Received intent from ${fp.substring(0, 8)}...`);
            if (!fromPeerId) {
              console.error(`[${this.guardianId}] Missing X-From-Peer-Id; cannot return verdict`);
              continue;
            }
            await this.handleIntent(message.intent, fromPeerId);
          }
        } else if (status !== 204) {
          console.warn(`[${this.guardianId}] /recv returned HTTP ${status} (expected 200 or 204)`);
        }
      } catch (error) {
        // AXL node is down — log once, back off to 2 s instead of spamming
        if (!this._axlDown) {
          this._axlDown = true;
          const msg = error instanceof Error ? error.message : String(error);
          console.warn(`[${this.guardianId}] ⚠ AXL node unreachable (${msg}) — waiting for node to start...`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        continue;
      }

      // Small delay between polls
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Handle incoming intent and send verdict back
   */
  async handleIntent(intent, fromPeerId) {
    try {
      console.log(`[${this.guardianId}] Evaluating intent from agent: ${intent.agent_id}`);
      console.log(`[${this.guardianId}] Action: ${intent.action_type} → ${intent.target}`);
      
      // Evaluate intent using guardian
      const result = await this.guardian.evaluateIntent(intent);
      
      // Create verdict message
      const verdictMessage = {
        type: 'guardmesh_verdict',
        timestamp: Date.now(),
        guardian_id: this.guardianId,
        guardian_key: this.ourPublicKey,
        verdict: result.verdict,
        tee_verified: result.teeVerified,
        policy_used: result.policy_used ?? null,
      };
      
      // Send verdict back to requester
      await axios.post(
        `${this.axlApiUrl}/send`,
        JSON.stringify(verdictMessage),
        {
          headers: {
            'X-Destination-Peer-Id': fromPeerId,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log(`[${this.guardianId}] ✓ Sent verdict: ${result.verdict.verdict} (TEE: ${result.teeVerified ? 'YES' : 'NO'})`);
      
    } catch (error) {
      console.error(`[${this.guardianId}] Error handling intent: ${error.message}`);
      
      // Send error verdict
      const errorVerdict = {
        type: 'guardmesh_verdict',
        timestamp: Date.now(),
        guardian_id: this.guardianId,
        guardian_key: this.ourPublicKey,
        verdict: {
          verdict: 'ERROR',
          reason: error.message
        },
        tee_verified: false,
        policy_used: null,
      };
      
      try {
        await axios.post(
          `${this.axlApiUrl}/send`,
          JSON.stringify(errorVerdict),
          {
            headers: {
              'X-Destination-Peer-Id': fromPeerId,
              'Content-Type': 'application/json'
            }
          }
        );
      } catch (sendError) {
        console.error(`[${this.guardianId}] Failed to send error verdict: ${sendError.message}`);
      }
    }
  }

  /**
   * Stop listening
   */
  stop() {
    this.running = false;
    console.log(`[${this.guardianId}] Stopped listening`);
  }

  /**
   * Get public key
   */
  getPublicKey() {
    return this.ourPublicKey;
  }
}

export default GuardianListener;
