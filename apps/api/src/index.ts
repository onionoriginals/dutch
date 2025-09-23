import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { helloDutch } from '@originals/dutch'

const app = new Elysia()
  .use(cors())
  .use(swagger())
  .get('/', () => ({ ok: true }))
  .get('/hello', () => ({ message: helloDutch('World') }))

let port = Bun.env.PORT ? parseInt(Bun.env.PORT, 10) : 3000
if (isNaN(port)) {
  console.error('Invalid PORT environment variable. Using default port 3000.')
  port = 3000
}
app.listen({ port, hostname: '0.0.0.0' })
console.log(`API running on http://localhost:${port}`)
