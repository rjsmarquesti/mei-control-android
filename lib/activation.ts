const API_BASE = 'https://activation.sismeipro.com.br'
const APP_ID = 'mei-control-pro'

export interface ActivationResult {
  ok: boolean
  token?: string
  error?: string
}

export async function activateOnline(email: string, codigo: string): Promise<ActivationResult> {
  try {
    const res = await fetch(`${API_BASE}/api/ativar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: APP_ID,
        email: email.toLowerCase().trim(),
        codigo: codigo.trim().toUpperCase(),
      }),
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error ?? 'Código inválido.' }
    return { ok: true, token: data.token }
  } catch {
    return { ok: false, error: 'Sem conexão. Verifique sua internet e tente novamente.' }
  }
}

export async function verifyTokenOnline(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/verificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: APP_ID, token }),
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    // Falha silenciosa — token local ainda válido (offline tolerance)
    return true
  }
}
