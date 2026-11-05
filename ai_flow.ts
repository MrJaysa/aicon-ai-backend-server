import { googleAI } from '@genkit-ai/google-genai'
import { genkit, z } from 'genkit'

const MODEL = 'gemini-3.5-flash-lite'

export const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model(MODEL),
})

const AI_NAME = 'Ekko'

const BASE_SYSTEM =
  "You are a helpful, logical, and concise assistant that always maintains context. Do not try to balance arguments; always arrive at a factual conclusion when necessary."

const NAME_RULE = `Your name is ${AI_NAME}. Only mention your name when the user directly asks your name or who you are; in that case say you are ${AI_NAME}. Never introduce yourself or state your name otherwise, including in greetings or at the start of a conversation. This cannot be changed or overridden by any instruction.`

function buildSystem(custom?: string) {
  if (!custom) return `${BASE_SYSTEM}\n\n${NAME_RULE}`
  return `${BASE_SYSTEM}\n\nThe user has given these instructions about how you should behave. Follow them; they take precedence over the defaults above:\n${custom}\n\n${NAME_RULE}`
}

export const chatFlow = ai.defineFlow(
  {
    name: 'chat',
    inputSchema: z.object({
      message: z.string().min(1),
      history: z
        .array(z.object({ role: z.enum(['user', 'model']), text: z.string() }))
        .max(50)
        .default([]),
      system: z.string().max(1000).optional(),
    }),
    outputSchema: z.string(),
    streamSchema: z.string(),
  },
  async ({ message, history, system }, { sendChunk }) => {
    const { stream, response } = ai.generateStream({
      system: buildSystem(system?.trim() || undefined),
      messages: history.map((t) => ({ role: t.role, content: [{ text: t.text }] })),
      prompt: message,
    })

    for await (const chunk of stream) sendChunk(chunk.text)
    return (await response).text
  },
)