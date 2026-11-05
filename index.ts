import cors from 'cors'
import express from 'express'
import { chatFlow } from './ai_flow.js'

const app = express()

const allowedOrigins = ['http://localhost:5173', 'https://aicon-jade.vercel.app'].filter(
  (o): o is string => Boolean(o),
)

app.use(cors({ origin: allowedOrigins }))
app.use(express.json({ limit: '1mb' }))

app.post('/api/chat', async (req, res) => {
  const { message, history = [], system } = req.body ?? {}
  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'message is required' })
    return
  }
  if (!Array.isArray(history) || history.length > 50) {
    res.status(400).json({ error: 'history must be an array of at most 50 items' })
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
    const { stream, output } = chatFlow.stream({ message, history, system })
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

if (process.env.NODE_ENV !== 'production') {
  const port = Number(process.env.PORT ?? 3000)
  app.listen(port, () => console.log(`http://localhost:${port}`))
}

export default app