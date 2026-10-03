// Play-count API: anonymous per-sound totals in MariaDB. No cookies,
// no identifiers, no request logging.
import http from 'node:http'
import mysql from 'mysql2/promise'

const PORT = Number(process.env.PORT ?? 3001)
const DB_CONFIG = {
  host: process.env.DB_HOST ?? 'db',
  port: Number(process.env.DB_PORT ?? 3306),
  database: process.env.DB_NAME ?? 'jsoundexplorer',
  user: process.env.DB_USER ?? 'jse',
  password: process.env.DB_PASSWORD ?? 'devpw-change-me',
}
const MAX_BODY_BYTES = 1024 * 1024
const MAX_BATCH_IDS = 1000
const MAX_PLAYS_PER_ID = 1000000
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? ''

function json(res, status, value) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

async function readBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('body too large')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf-8')
}

function validBatch(plays) {
  if (plays === null || typeof plays !== 'object' || Array.isArray(plays)) return null
  const entries = Object.entries(plays)
  if (entries.length === 0 || entries.length > MAX_BATCH_IDS) return null
  const rows = []
  for (const [id, n] of entries) {
    if (typeof id !== 'string' || id.length === 0 || id.length > 255) return null
    if (!Number.isInteger(n) || n < 1 || n > MAX_PLAYS_PER_ID) return null
    rows.push([id, n])
  }
  return rows
}

const pool = mysql.createPool({ ...DB_CONFIG, waitForConnections: true, connectionLimit: 4 })

async function waitForDb() {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query('SELECT 1')
      return
    } catch (err) {
      if (attempt >= 30) throw err
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}

await waitForDb()
await pool.query(`
  CREATE TABLE IF NOT EXISTS plays (
    sound_id VARCHAR(255) PRIMARY KEY,
    plays BIGINT UNSIGNED NOT NULL DEFAULT 0
  )
`)

const server = http.createServer(async (req, res) => {
  try {
    if (CORS_ORIGIN) {
      res.setHeader('access-control-allow-origin', CORS_ORIGIN)
      res.setHeader('vary', 'Origin')
    }
    if (req.method === 'OPTIONS') {
      if (CORS_ORIGIN) {
        res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS')
        res.setHeader('access-control-allow-headers', 'content-type')
        res.setHeader('access-control-max-age', '86400')
      }
      res.writeHead(204)
      res.end()
      return
    }
    const url = new URL(req.url ?? '/', 'http://x')
    if (req.method === 'GET' && url.pathname === '/api/health') {
      json(res, 200, { ok: true })
      return
    }
    if (req.method === 'GET' && url.pathname === '/api/plays') {
      const [rows] = await pool.query('SELECT sound_id AS id, plays FROM plays')
      const counts = {}
      for (const row of rows) counts[row.id] = Number(row.plays)
      json(res, 200, { counts })
      return
    }
    if (req.method === 'POST' && url.pathname === '/api/plays') {
      let body
      try {
        body = JSON.parse(await readBody(req))
      } catch {
        json(res, 400, { error: 'invalid JSON body' })
        return
      }
      const rows = validBatch(body?.plays)
      if (!rows) {
        json(res, 400, { error: 'invalid plays batch' })
        return
      }
      await pool.query(
        'INSERT INTO plays (sound_id, plays) VALUES ? ON DUPLICATE KEY UPDATE plays = plays + VALUES(plays)',
        [rows],
      )
      res.writeHead(204)
      res.end()
      return
    }
    json(res, 404, { error: 'not found' })
  } catch (err) {
    console.error('request failed:', err?.message ?? err)
    if (!res.headersSent) json(res, 500, { error: 'internal error' })
    else res.end()
  }
})

server.listen(PORT, () => {
  console.log(`plays api on :${PORT}`)
})
