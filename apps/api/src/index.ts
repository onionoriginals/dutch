import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { helloDutch } from '@originals/dutch'

const app = new Elysia()
  .use(cors())
  .use(swagger())
  .get('/', () => ({ ok: true }))
  .get('/hello', () => ({ message: helloDutch('World') }))

app.listen({ port: 3000, hostname: '0.0.0.0' })
console.log(`API running on http://localhost:3000`)
