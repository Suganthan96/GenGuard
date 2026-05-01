/**
 * AXL /recv helpers.
 *
 * Historically axios was used for GET /recv. Axios default transformResponse can
 * call JSON.parse on response bodies; some AXL nodes return non-JSON or odd payloads
 * on spoke ports, which surfaced as: "[object Object]" is not valid JSON.
 *
 * We use native fetch + text for /recv so the wire body is always parsed explicitly
 * in axlBodyToJson (same behavior as GenGuard Web bridge).
 */

/** @param {unknown} data */
export function axlBodyToJson(data) {
  if (data == null || data === "") return null;
  if (typeof data === "object" && !Buffer.isBuffer(data)) return data;
  const s = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
  const t = s.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/** Kept for callers that still use axios with explicit responseType: 'text'. */
export const axlRecvRequestOptions = {
  validateStatus: (status) => status === 200 || status === 204,
  responseType: "text",
  transitional: { forcedJSONParsing: false, silentJSONParsing: true },
};

/** @param {import('axios').AxiosResponse} response */
export function axlFromPeerId(response) {
  const h = response.headers || {};
  return h["x-from-peer-id"] || h["X-From-Peer-Id"] || "";
}

/**
 * Dequeue one message from AXL /recv using fetch (avoids axios JSON transforms).
 * @param {string} axlApiUrl
 * @returns {Promise<{ status: number, fromPeerId: string, bodyText: string }>}
 */
export async function axlRecvFetch(axlApiUrl) {
  const base = axlApiUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/recv`, { method: "GET", cache: "no-store" });
  const fromPeerId =
    res.headers.get("x-from-peer-id") || res.headers.get("X-From-Peer-Id") || "";
  const bodyText = res.status === 204 ? "" : await res.text();
  return { status: res.status, fromPeerId, bodyText };
}
