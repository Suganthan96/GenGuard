/**
 * When the hub AXL node runs a GuardianListener, it shares /recv with the
 * IntentBroadcaster. Verdict messages can be dequeued by the listener and
 * would otherwise be dropped. Stray verdicts are appended here; the client
 * drains this file while polling.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPOOL = path.join(__dirname, '.verdict-spool.ndjson');

export function clearVerdictSpool() {
  try {
    fs.writeFileSync(SPOOL, '', 'utf8');
  } catch {
    /* ignore */
  }
}

export function appendStrayVerdict(record) {
  const line = `${JSON.stringify(record)}\n`;
  fs.appendFileSync(SPOOL, line, 'utf8');
}

/**
 * Read and remove all lines (best-effort drain for polling loop).
 * @returns {Array<{ peerId: string, verdict: object, timestamp?: number }>}
 */
export function drainStrayVerdicts() {
  if (!fs.existsSync(SPOOL)) return [];
  let raw;
  try {
    raw = fs.readFileSync(SPOOL, 'utf8');
    fs.writeFileSync(SPOOL, '', 'utf8');
  } catch {
    return [];
  }
  const out = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try {
      const msg = JSON.parse(t);
      if (msg.type === 'guardmesh_verdict' && msg.verdict) {
        out.push({
          peerId: msg.fromPeerId || msg.guardian_key,
          verdict: { ...msg.verdict, tee_verified: msg.tee_verified },
          timestamp: msg.timestamp,
        });
      }
    } catch {
      /* skip bad line */
    }
  }
  return out;
}
