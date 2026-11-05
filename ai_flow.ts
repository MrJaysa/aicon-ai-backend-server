import { googleAI } from '@genkit-ai/google-genai'
import { genkit, z } from 'genkit'

const MODEL = 'gemini-3.5-flash-lite'

export const ai = genkit({
  plugins: [googleAI()],
  model: googleAI.model(MODEL),
})

const BASE_SYSTEM =
  'You are a helpful, always maintain context, logical and a very concise assistant.'

function buildSystem(custom?: string) {
  if (!custom) return BASE_SYSTEM
  return `${BASE_SYSTEM}\n\nThe user has given these instructions about how you should behave. Follow them; they take precedence over the defaults above:\n${custom}`
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