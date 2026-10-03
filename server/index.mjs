// Play-count API: anonymous per-sound totals in MariaDB. No cookies,
// no identifiers, no request logging. Also proxies single Mojang
// samples (the CDN sends no CORS headers, so browsers cannot fetch
// them directly for pitch analysis).
import http from 'node:http'
import https from 'node:https'
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
const SAMPLE_UPSTREAM = 'https://resources.download.minecraft.net'
const MAX_SAMPLE_BYTES = 10 * 1024 * 1024
const SAMPLE_TIMEOUT_MS = 15000

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

function validSampleHash(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value) ? value : null
}

function fetchUpstreamBytes(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: SAMPLE_TIMEOUT_MS }, (upstream) => {
      if (upstream.statusCode !== 200) {
        upstream.resume()
        reject(new Error(`upstream ${upstream.statusCode}`))
        return
      }
      const chunks = []
      let size = 0
      upstream.on('data', (chunk) => {
        size += chunk.length
        if (size > MAX_SAMPLE_BYTES) {
          req.destroy()
          reject(new Error('sample too large'))
          return
        }
        chunks.push(chunk)
      })
      upstream.on('end', () => resolve(Buffer.concat(chunks)))
      upstream.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error('upstream timeout')))
    req.on('error', reject)
  })
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
await pool.query(`
  CREATE TABLE IF NOT EXISTS hourly_plays (
    hour_utc DATETIME PRIMARY KEY,
    plays BIGINT UNSIGNED NOT NULL DEFAULT 0
  )
`)
await pool.query(`
  CREATE TABLE IF NOT EXISTS daily_plays (
    day_utc DATE PRIMARY KEY,
    plays BIGINT UNSIGNED NOT NULL DEFAULT 0
  )
`)
await pool.query(`
  CREATE TABLE IF NOT EXISTS monthly_plays (
    month_utc DATE PRIMARY KEY,
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
    if (req.method === 'GET' && url.pathname === '/api/plays/hourly') {
      const [hourRows] = await pool.query(
        `SELECT DATE_FORMAT(hour_utc, '%Y-%m-%dT%H:00:00Z') AS hour, plays
         FROM hourly_plays
         WHERE hour_utc > UTC_TIMESTAMP() - INTERVAL 8 HOUR
         ORDER BY hour_utc ASC
         LIMIT 8`,
      )
      const hours = []
      for (const row of hourRows) hours.push({ hour: row.hour, plays: Number(row.plays) })
      json(res, 200, { hours })
      return
    }
    if (req.method === 'GET' && url.pathname === '/api/plays/daily') {
      const [dayRows] = await pool.query(
        `SELECT DATE_FORMAT(day_utc, '%Y-%m-%dT00:00:00Z') AS day, plays
         FROM daily_plays
         WHERE day_utc > UTC_DATE() - INTERVAL 7 DAY
         ORDER BY day_utc ASC
         LIMIT 7`,
      )
      const days = []
      for (const row of dayRows) days.push({ day: row.day, plays: Number(row.plays) })
      json(res, 200, { days })
      return
    }
    if (req.method === 'GET' && url.pathname === '/api/plays/monthly') {
      const [monthRows] = await pool.query(
        `SELECT DATE_FORMAT(month_utc, '%Y-%m-%dT00:00:00Z') AS month, plays
         FROM monthly_plays
         WHERE month_utc > UTC_DATE() - INTERVAL 12 MONTH
         ORDER BY month_utc ASC
         LIMIT 12`,
      )
      const months = []
      for (const row of monthRows) months.push({ month: row.month, plays: Number(row.plays) })
      json(res, 200, { months })
      return
    }
    if (req.method === 'GET' && url.pathname === '/api/sample') {
      const hash = validSampleHash(url.searchParams.get('hash'))
      if (!hash) {
        json(res, 400, { error: 'invalid sample hash' })
        return
      }
      try {
        const bytes = await fetchUpstreamBytes(`${SAMPLE_UPSTREAM}/${hash.slice(0, 2)}/${hash}`)
        res.writeHead(200, {
          'content-type': 'audio/ogg',
          'content-length': bytes.length,
          'cache-control': 'public, max-age=31536000, immutable',
        })
        res.end(bytes)
      } catch {
        json(res, 502, { error: 'sample unavailable' })
      }
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
      const total = rows.reduce((sum, [, n]) => sum + n, 0)
      await pool.query(
        `INSERT INTO hourly_plays (hour_utc, plays)
         VALUES (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%d %H:00:00'), ?)
         ON DUPLICATE KEY UPDATE plays = plays + VALUES(plays)`,
        [total],
      )
      await pool.query(
        `INSERT INTO daily_plays (day_utc, plays)
         VALUES (UTC_DATE(), ?)
         ON DUPLICATE KEY UPDATE plays = plays + VALUES(plays)`,
        [total],
      )
      await pool.query(
        `INSERT INTO monthly_plays (month_utc, plays)
         VALUES (DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01'), ?)
         ON DUPLICATE KEY UPDATE plays = plays + VALUES(plays)`,
        [total],
      )
      // Readers only need the last 8h/7d/12m; keep margin past that.
      await pool.query('DELETE FROM hourly_plays WHERE hour_utc < UTC_TIMESTAMP() - INTERVAL 2 DAY')
      await pool.query('DELETE FROM daily_plays WHERE day_utc < UTC_DATE() - INTERVAL 30 DAY')
      await pool.query('DELETE FROM monthly_plays WHERE month_utc < UTC_DATE() - INTERVAL 730 DAY')
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
