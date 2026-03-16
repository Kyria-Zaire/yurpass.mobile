import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  // eslint-disable-next-line no-restricted-syntax
  process.stdout.write(`Server running on port ${info.port}\n`)
})

export default app
