import { googleAI } from '@genkit-ai/google-genai'
import { genkit, z } from 'genkit'

const MODEL = 'gemini-3.5-flash-lite'

export const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model(MODEL),
})

type Turn = { role: 'user' | 'model'; content: [{ text: string }] }

const BASE_SYSTEM =
  'You are a helpful, always maintain context, logical and a very concise assistant.'

function buildSystem(custom?: string) {
  if (!custom) return BASE_SYSTEM
  return `${BASE_SYSTEM}\n\nThe user has given these instructions about how you should behave. Follow them; they take precedence over the defaults above:\n${custom}`
}

const SESSION_TTL_MS = 60 * 60 * 1000

const sessions = new Map<string, { turns: Turn[]; lastUsed: number; system?: string }>()

export function clearSession(sessionId: string) {
  sessions.delete(sessionId)
}

setInterval(
  () => {
    const cutoff = Date.now() - SESSION_TTL_MS
    for (const [id, s] of sessions) if (s.lastUsed < cutoff) sessions.delete(id)
  },
  5 * 60 * 1000,
).unref()

export const chatFlow = ai.defineFlow(
  {
    name: 'chat',
    inputSchema: z.object({
      sessionId: z.string().min(1),
      message: z.string().min(1),
      system: z.string().max(1000).optional(),
    }),
    outputSchema: z.string(),
    streamSchema: z.string(),
  },
  async ({ sessionId, message, system }, { sendChunk }) => {
    const session = sessions.get(sessionId) ?? {
      turns: [],
      lastUsed: Date.now(),
      system: system?.trim() || undefined,
    }

    const { stream, response } = ai.generateStream({
      system: buildSystem(session.system),
      messages: session.turns,
      prompt: message,
    })

    for await (const chunk of stream) sendChunk(chunk.text)

    const reply = (await response).text
    session.turns.push(
      { role: 'user', content: [{ text: message }] },
      { role: 'model', content: [{ text: reply }] },
    )
    session.lastUsed = Date.now()
    sessions.set(sessionId, session)
    return reply
  },
)