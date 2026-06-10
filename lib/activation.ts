// SALT injetado em build time via EAS Secrets (EXPO_PUBLIC_ACTIVATION_SALT)
// Nunca hardcoded no repositório
const SALT = process.env.EXPO_PUBLIC_ACTIVATION_SALT ?? ''

// HMAC-SHA256 puro em JS — compatível com o gerar-codigo.js do kit
// Usa a mesma lógica: createHmac('sha256', salt).update(email).digest('hex').slice(0,8).toUpperCase()
async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function generateCode(email: string): Promise<string> {
  if (!SALT) throw new Error('SALT não configurado')
  const hash = await hmacSha256Hex(SALT, email.toLowerCase().trim())
  return hash.slice(0, 8).toUpperCase()
}

export async function validateCode(email: string, code: string): Promise<boolean> {
  if (!SALT) throw new Error('[MEI Kit] EXPO_PUBLIC_ACTIVATION_SALT não configurado no build.')
  const expected = await generateCode(email)
  return expected === code.trim().toUpperCase()
}
