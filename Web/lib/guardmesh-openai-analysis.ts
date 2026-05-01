import { buildAnalysisMessages, type AgentPolicyContext } from "@/lib/agent-analysis-prompt"

function chatCompletionsUrl(): string {
  const raw = process.env.OPENAI_API_BASE?.trim()
  if (raw) {
    const base = raw.replace(/\/+$/, "")
    return base.endsWith("/chat/completions") ? base : `${base}/chat/completions`
  }
  return "https://api.openai.com/v1/chat/completions"
}

function groqChatCompletionsUrl(): string {
  const raw = process.env.GROQ_API_ENDPOINT?.trim()
  if (raw) return raw
  return "https://api.groq.com/openai/v1/chat/completions"
}

export async function openAiChatCompletion(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<{ text: string; model: string }> {
  const key = process.env.OPENAI_API_KEY?.trim()
  const groqKey = process.env.GROQ_API_KEY?.trim()
  const useGroq = process.env.GUARDMESH_USE_GROQ_LLM === "1" || (!key && !!groqKey)
  const model = useGroq
    ? process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile"
    : process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini"
  const url = useGroq ? groqChatCompletionsUrl() : chatCompletionsUrl()
  /** @type {Record<string, string>} */
  const headers: Record<string, string> = {
    Authorization: `Bearer ${useGroq ? groqKey : key}`,
    "Content-Type": "application/json",
  }
  if (!useGroq && !key) {
    throw new Error("OPENAI_API_KEY is not set")
  }
  if (useGroq && !groqKey) {
    throw new Error("GROQ_API_KEY is not set")
  }
  const referer = process.env.OPENROUTER_HTTP_REFERER?.trim()
  const title = process.env.OPENROUTER_APP_TITLE?.trim()
  if (!useGroq) {
    if (referer) headers["HTTP-Referer"] = referer
    if (title) headers["X-Title"] = title
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 2000,
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Chat API ${res.status}: ${t.slice(0, 400)}`)
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const text = data.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error("Empty model response")
  return { text, model: useGroq ? `groq/${model}` : model }
}

export async function runPolicyScopedCodeAnalysis(args: {
  policy: AgentPolicyContext
  code: string
  question?: string
}): Promise<{ analysis: string; model: string }> {
  const messages = buildAnalysisMessages(args.policy, args.code, args.question ?? "")
  const { text, model } = await openAiChatCompletion(messages)
  return { analysis: text, model }
}
