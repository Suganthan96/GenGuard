import { NextResponse } from "next/server";

export const runtime = "nodejs";

type WebhookBody = {
  intent?: Record<string, unknown>;
  consensus_threshold?: string;
};

function getBearer(req: Request): string {
  const raw = req.headers.get("authorization") || "";
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  return raw.slice(7).trim();
}

export async function POST(req: Request) {
  const expected = process.env.GUARDMESH_WEBHOOK_TOKEN?.trim() || "";
  if (expected) {
    const got = getBearer(req);
    if (!got || got !== expected) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: WebhookBody;
  try {
    body = (await req.json()) as WebhookBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const intent = body.intent && typeof body.intent === "object" ? body.intent : body;
  if (!intent || typeof intent !== "object") {
    return NextResponse.json({ ok: false, error: "Missing intent object" }, { status: 400 });
  }

  const origin = new URL(req.url).origin;
  const forwardBody: Record<string, unknown> = { intent };
  if (typeof body.consensus_threshold === "string" && body.consensus_threshold.trim()) {
    forwardBody.consensus_threshold = body.consensus_threshold.trim();
  }

  try {
    const res = await fetch(`${origin}/api/guardmesh/intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forwardBody),
      signal: AbortSignal.timeout(120000)
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return NextResponse.json(
      {
        ok: res.ok,
        webhook: true,
        forward_status: res.status,
        result: json
      },
      { status: res.ok ? 200 : 502 }
    );
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e)
      },
      { status: 502 }
    );
  }
}

