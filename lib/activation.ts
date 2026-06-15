import { hmac } from 'js-sha256'

const SALT = process.env['EXPO_PUBLIC_ACTIVATION_SALT'] ?? 'mei-kit-2026-prod'

export async function generateCode(email: string): Promise<string> {
  const hash = hmac(SALT, email.toLowerCase().trim())
  return hash.slice(0, 8).toUpperCase()
}

export async function validateCode(email: string, code: string): Promise<boolean> {
  const expected = await generateCode(email)
  return expected === code.trim().toUpperCase()
}
