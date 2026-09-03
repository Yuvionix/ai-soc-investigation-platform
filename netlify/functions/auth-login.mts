import crypto from 'node:crypto'

// Mirrors backend/app/services/auth_service.py so the same demo accounts and
// passwords work whether the FastAPI backend or this function answers the request.
const SALT = 'soc-rt-salt-2024'
const JWT_SECRET = process.env.JWT_SECRET || 'soc-default-secret-key-change-in-production'
const TOKEN_TTL_SECONDS = 60 * 60

function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, SALT, 260_000, 32, 'sha256').toString('hex')
}

const USERS: Record<string, { username: string; name: string; role: string; hashedPassword: string }> = {
  admin: {
    username: 'admin',
    name: 'SOC Administrator',
    role: 'Admin',
    hashedPassword: hashPassword(process.env.SOC_ADMIN_PASSWORD || 'Admin@123'),
  },
  analyst: {
    username: 'analyst',
    name: 'L1 Analyst',
    role: 'Analyst',
    hashedPassword: hashPassword(process.env.SOC_ANALYST_PASSWORD || 'Analyst@123'),
  },
}

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function signToken(payload: Record<string, unknown>): string {
  const headerB64 = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)))
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${headerB64}.${payloadB64}`).digest()
  return `${headerB64}.${payloadB64}.${base64url(signature)}`
}

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let body: { username?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ detail: 'Invalid request body' }, { status: 400 })
  }

  const user = body.username ? USERS[body.username] : undefined
  const suppliedHash = body.password ? hashPassword(body.password) : ''

  let valid = false
  if (user && suppliedHash.length === user.hashedPassword.length) {
    valid = crypto.timingSafeEqual(Buffer.from(suppliedHash), Buffer.from(user.hashedPassword))
  }

  if (!user || !valid) {
    return Response.json({ detail: 'Invalid username or password' }, { status: 401 })
  }

  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS
  const access_token = signToken({ sub: user.username, role: user.role, exp })

  return Response.json({
    access_token,
    token_type: 'bearer',
    username: user.username,
    name: user.name,
    role: user.role,
  })
}

export const config = {
  path: '/api/auth/login',
}
