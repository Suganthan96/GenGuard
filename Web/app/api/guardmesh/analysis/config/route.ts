import { NextResponse } from "next/server"

export const runtime = "nodejs"

/** Non-secret bits for the Agent analysis UI (model id, whether base URL is overridden). */
export async function GET() {
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini"
  const customBase = Boolean(process.env.OPENAI_API_BASE?.trim())
  return NextResponse.json({
    model,
    customChatCompletionsBase: customBase,
  })
}
