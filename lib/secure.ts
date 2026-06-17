import * as SecureStore from 'expo-secure-store'

// PII do usuário armazenada no keystore do Android (criptografado em hardware)
// Use este módulo para token, email — não getConfig/setConfig do SQLite

export async function getSecure(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key)
}

export async function setSecure(key: string, value: string): Promise<void> {
  return SecureStore.setItemAsync(key, value)
}

export async function deleteSecure(key: string): Promise<void> {
  return SecureStore.deleteItemAsync(key)
}

// ── Token de ativação (JWT server-side) ──────────────────────────────────────

const TOKEN_KEY = 'activation_token'

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY)
}

export async function setToken(token: string): Promise<void> {
  return SecureStore.setItemAsync(TOKEN_KEY, token)
}

export async function clearAuth(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY),
    SecureStore.deleteItemAsync('email'),
  ])
}
