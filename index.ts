import cors from 'cors'
import express from 'express'
import { chatFlow, clearSession } from './ai_flow'

const port = Number(process.env.PORT ?? 3000)

const app = express()

app.use(cors({ origin: process.env.FRONTEND_URL ?? true }))

app.use(express.json())

app.post('/api/chat', async (req, res) => {
  const { sessionId, message, system } = req.body ?? {}
  if (typeof sessionId !== 'string' || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'sessionId and message are required' })
    return
  }
  if (system !== undefined && (typeof system !== 'string' || system.length > 1000)) {
    res.status(400).json({ error: 'system must be a string of at most 1000 characters' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  try {
    const { stream, output } = chatFlow.stream({ sessionId, message, system })
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`)
    }
    await output
    res.write('event: done\ndata: {}\n\n')
  } catch (err) {
    console.error(err)
    res.write(`event: error\ndata: ${JSON.stringify('Something went wrong')}\n\n`)
  } finally {
    res.end()
  }
})

app.delete('/api/chat/:sessionId', (req, res) => {
  clearSession(req.params.sessionId)
  res.status(204).end()
})

app.listen(port, () => console.log(`http://localhost:${port}`))