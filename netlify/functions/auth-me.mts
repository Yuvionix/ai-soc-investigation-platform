import crypto from 'node:crypto'

// Mirrors backend/app/api/auth.py's GET /me — validates the Bearer token issued
// by auth-login.mts and returns the same shape the frontend expects.
const JWT_SECRET = process.env.JWT_SECRET || 'soc-default-secret-key-change-in-production'

const USER_INFO: Record<string, { name: string; role: string }> = {
  admin: { name: 'SOC Administrator', role: 'Admin' },
  analyst: { name: 'L1 Analyst', role: 'Analyst' },
}

function base64urlToBuffer(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function verifyToken(token: string): { sub: string; exp: number } | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, sigB64] = parts

  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${headerB64}.${payloadB64}`).digest()
  const providedSig = base64urlToBuffer(sigB64)
  if (expectedSig.length !== providedSig.length || !crypto.timingSafeEqual(expectedSig, providedSig)) {
    return null
  }

  try {
    const payload = JSON.parse(base64urlToBuffer(payloadB64).toString('utf8'))
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null
    if (typeof payload.sub !== 'string') return null
    return payload
  } catch {
    return null
  }
}

export default async (req: Request) => {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const payload = token ? verifyToken(token) : null
  const info = payload ? USER_INFO[payload.sub] : undefined

  if (!payload || !info) {
    return Response.json({ detail: 'Invalid or expired token' }, { status: 401 })
  }

  return Response.json({ username: payload.sub, name: info.name, role: info.role })
}

export const config = {
  path: '/api/auth/me',
}
