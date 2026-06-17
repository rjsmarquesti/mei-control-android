import * as SecureStore from 'expo-secure-store'

// PII do usuário armazenada no keystore do Android (criptografado em hardware)
// Use este módulo para activated e email — não getConfig/setConfig do SQLite

export async function getSecure(key: string): Promise<string | null> {
  return SecureStore.getItemAsync(key)
}

export async function setSecure(key: string, value: string): Promise<void> {
  return SecureStore.setItemAsync(key, value)
}

export async function deleteSecure(key: string): Promise<void> {
  return SecureStore.deleteItemAsync(key)
}
