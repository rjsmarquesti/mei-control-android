const API_BASE = 'https://app.sismeipro.com.br'

export interface ActivationResult {
  ok: boolean
  token?: string
  error?: string
}

export async function activateOnline(email: string, codigo: string): Promise<ActivationResult> {
  try {
    const res = await fetch(`${API_BASE}/api/mei-ativar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.toLowerCase().trim(), codigo: codigo.trim().toUpperCase() }),
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
    const res = await fetch(`${API_BASE}/api/mei-verificar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    // Falha silenciosa — token local ainda válido (offline tolerance)
    return true
  }
}
